const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar módulos
const robloxAPI = require('./roblox-api');
const firebaseUtils = require('./firebase-utils');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Em produção, especifique o IP do Roblox Studio
    methods: ["GET", "POST"]
  }
});

// Configurar CORS para produção
const allowedOrigins = [
  'https://www.roblox.com',
  'https://web.roblox.com',
  'http://localhost:3000',
  'http://localhost:64537', // Roblox Studio
  // Adicione outros domínios necessários
];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Variáveis de controle
const API_KEY = process.env.API_KEY || 'SUA_CHAVE_SECRETA_AQUI';
const connectedClients = new Map();

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'A política de CORS não permite acesso desta origem.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Servir página de status
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check para Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Tratamento de erro 404
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Rota ${req.originalUrl} não encontrada`
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Erro:', err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 🔥 ROTAS HTTP (para requests do Roblox)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    clients: connectedClients.size,
    timestamp: new Date().toISOString()
  });
});

// 🔐 Middleware de autenticação
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API key inválida ou ausente'
    });
  }
  
  next();
};

// 🔍 OBTER INFORMAÇÕES DE UM GRUPO POR ID
app.get('/api/grupo/:grupoId', authenticate, async (req, res) => {
  try {
    const { grupoId } = req.params;
    const { nivelMinimo, nivelMaximo } = req.query;
    
    console.log(`[API] Requisição para grupo: ${grupoId}`);
    
    // Obter informações do grupo
    const grupoInfo = await firebaseUtils.obterGrupoPorId(grupoId);
    
    if (!grupoInfo) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: `Grupo ${grupoId} não encontrado` 
      });
    }
    
    // Obter membros do grupo
    let membros = await firebaseUtils.obterMembrosGrupo(grupoId);
    
    // Filtrar por nível se especificado
    if (nivelMinimo || nivelMaximo) {
      membros = membros.filter(membro => {
        const nivel = membro.nivel || 1;
        const min = nivelMinimo ? parseInt(nivelMinimo) : 1;
        const max = nivelMaximo ? parseInt(nivelMaximo) : 99;
        return nivel >= min && nivel <= max;
      });
    }
    
    // Obter cargos do grupo
    const cargos = await firebaseUtils.obterCargosGrupo(grupoId);
    
    // Preparar resposta
    const resposta = {
      success: true,
      grupo: {
        id: grupoInfo.id,
        nome: grupoInfo.nome,
        descricao: grupoInfo.descricao,
        donoId: grupoInfo.donoId,
        donoTag: grupoInfo.donoTag,
        totalMembros: grupoInfo.totalMembros || 0,
        totalContribuicoes: grupoInfo.totalContribuicoes || 0,
        nivel: grupoInfo.nivel || 1,
        xp: grupoInfo.xp || 0,
        privacidade: grupoInfo.privacidade || 'publico',
        criadoEm: grupoInfo.criadoEm
      },
      cargos: cargos.map(cargo => ({
        nome: cargo.nome,
        nivel: cargo.nivel,
        sistema: cargo.sistema || false,
        membros: cargo.membros || 0
      })),
      membros: membros.map(membro => ({
        usuarioId: membro.usuarioId,
        cargo: membro.cargo,
        nivel: membro.nivel || 1,
        contribuicao: membro.contribuicao || 0,
        xp: membro.xp || 0,
        entrouEm: membro.entrouEm,
        ativo: membro.ativo !== false
      })),
      estatisticas: {
        totalMembros: membros.length,
        membrosAtivos: membros.filter(m => m.ativo !== false).length,
        totalContribuicao: membros.reduce((sum, m) => sum + (m.contribuicao || 0), 0),
        mediaNivel: membros.length > 0 
          ? (membros.reduce((sum, m) => sum + (m.nivel || 1), 0) / membros.length).toFixed(2)
          : 0
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(resposta);
    
  } catch (error) {
    console.error('[API] Erro ao obter grupo:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// 🔍 BUSCAR GRUPO POR NOME
app.get('/api/buscar-grupo', authenticate, async (req, res) => {
  try {
    const { nome, limite = 10 } = req.query;
    
    if (!nome) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Parâmetro "nome" é obrigatório' 
      });
    }
    
    const grupos = await firebaseUtils.buscarGruposPorNome(nome, parseInt(limite));
    
    res.json({
      success: true,
      query: nome,
      resultados: grupos.length,
      grupos: grupos.map(grupo => ({
        id: grupo.id,
        nome: grupo.nome,
        descricao: grupo.descricao,
        donoTag: grupo.donoTag,
        totalMembros: grupo.totalMembros || 0,
        totalContribuicoes: grupo.totalContribuicoes || 0,
        privacidade: grupo.privacidade || 'publico'
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Erro ao buscar grupos:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// 👤 OBTER INFORMAÇÕES DE UM MEMBRO
app.get('/api/membro/:usuarioId', authenticate, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { grupoId } = req.query;
    
    let gruposMembro;
    
    if (grupoId) {
      // Informações do membro em um grupo específico
      const membroInfo = await firebaseUtils.obterMembroNoGrupo(grupoId, usuarioId);
      
      if (!membroInfo) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Membro não encontrado neste grupo' 
        });
      }
      
      gruposMembro = [{
        grupoId,
        cargo: membroInfo.cargo,
        nivel: membroInfo.nivel || 1,
        contribuicao: membroInfo.contribuicao || 0,
        xp: membroInfo.xp || 0,
        entrouEm: membroInfo.entrouEm,
        ativo: membroInfo.ativo !== false
      }];
    } else {
      // Todos os grupos do membro
      gruposMembro = await firebaseUtils.obterGruposDoMembro(usuarioId);
    }
    
    res.json({
      success: true,
      usuarioId,
      totalGrupos: gruposMembro.length,
      grupos: gruposMembro,
      estatisticas: {
        totalContribuicao: gruposMembro.reduce((sum, g) => sum + (g.contribuicao || 0), 0),
        totalXP: gruposMembro.reduce((sum, g) => sum + (g.xp || 0), 0),
        mediaNivel: gruposMembro.length > 0 
          ? (gruposMembro.reduce((sum, g) => sum + (g.nivel || 1), 0) / gruposMembro.length).toFixed(2)
          : 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Erro ao obter membro:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// 🏆 RANKING DE GRUPOS
app.get('/api/ranking', authenticate, async (req, res) => {
  try {
    const { limite = 10, tipo = 'membros' } = req.query;
    
    let ranking;
    
    switch (tipo) {
      case 'contribuicoes':
        ranking = await firebaseUtils.getRankingPorContribuicoes(parseInt(limite));
        break;
      case 'nivel':
        ranking = await firebaseUtils.getRankingPorNivel(parseInt(limite));
        break;
      case 'membros':
      default:
        ranking = await firebaseUtils.getRankingPorMembros(parseInt(limite));
    }
    
    res.json({
      success: true,
      tipo,
      limite: parseInt(limite),
      ranking: ranking.map((grupo, index) => ({
        posicao: index + 1,
        id: grupo.id,
        nome: grupo.nome,
        donoTag: grupo.donoTag,
        totalMembros: grupo.totalMembros || 0,
        totalContribuicoes: grupo.totalContribuicoes || 0,
        nivel: grupo.nivel || 1,
        xp: grupo.xp || 0
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Erro ao obter ranking:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

// 🎯 WEBSOCKET (Comunicação em tempo real)
io.on('connection', (socket) => {
  console.log(`[Socket] Novo cliente conectado: ${socket.id}`);
  
  // Autenticação via socket
  socket.on('authenticate', (data) => {
    if (data.apiKey === API_KEY) {
      connectedClients.set(socket.id, {
        authenticated: true,
        connectedAt: new Date().toISOString()
      });
      
      socket.emit('authenticated', { 
        success: true, 
        message: 'Autenticado com sucesso' 
      });
      
      console.log(`[Socket] Cliente ${socket.id} autenticado`);
    } else {
      socket.emit('error', { 
        success: false, 
        message: 'Falha na autenticação' 
      });
    }
  });
  
  // Ouvir por atualizações em tempo real
  socket.on('subscribe-group', async (grupoId) => {
    if (!connectedClients.get(socket.id)?.authenticated) {
      return socket.emit('error', { message: 'Não autenticado' });
    }
    
    console.log(`[Socket] Cliente ${socket.id} inscrito no grupo ${grupoId}`);
    
    // Enviar dados iniciais
    try {
      const grupoInfo = await firebaseUtils.obterGrupoPorId(grupoId);
      
      if (grupoInfo) {
        socket.emit('group-data', {
          type: 'initial',
          grupoId,
          data: grupoInfo,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  // Desconexão
  socket.on('disconnect', () => {
    connectedClients.delete(socket.id);
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  🚀 Servidor rodando!
  📍 Porta: ${PORT}
  📅 ${new Date().toLocaleString()}
  
  🔗 Endpoints:
  • GET  /api/status
  • GET  /api/grupo/:id
  • GET  /api/buscar-grupo?nome=...
  • GET  /api/membro/:id
  • GET  /api/ranking
  
  🔐 API Key: ${API_KEY}
  🔌 Socket.io: ws://localhost:${PORT}
  `);
});