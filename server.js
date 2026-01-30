const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Importar módulos
const firebaseUtils = require('./firebase-utils');

const app = express();
const server = http.createServer(app);

// 🔥 CORREÇÃO 1: Configure CORS APENAS UMA VEZ, NO INÍCIO
app.use(cors()); // Configuração simples primeiro

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Variáveis de controle
const API_KEY = process.env.API_KEY || 'SYSTEM_BY_NIKI';
const connectedClients = new Map();

// 🔥 CORREÇÃO 2: Middlewares básicos
app.use(express.json());

// 🔥 CORREÇÃO 3: Remova ou comente a pasta public se não existe
// app.use(express.static('public')); // COMENTE ESTA LINHA SE NÃO TEM PASTA PUBLIC

// 🔥 CORREÇÃO 4: Rota raiz SIMPLES
app.get('/', (req, res) => {
  res.json({ 
    message: 'Discord ↔ Roblox API Bridge',
    status: 'online',
    endpoints: {
      status: '/api/status',
      grupo: '/api/grupo/:id',
      buscar: '/api/buscar-grupo',
      membro: '/api/membro/:id',
      ranking: '/api/ranking',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check para Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 🔥 ROTAS HTTP (para requests do Roblox) - COLOCAR ANTES DOS HANDLERS DE ERRO!
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
    
    console.log(`[API] Requisição para grupo: ${grupoId}`);
    
    // Obter informações do grupo
    const grupoInfo = await firebaseUtils.obterGrupoPorId(grupoId);
    
    if (!grupoInfo) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: `Grupo ${grupoId} não encontrado` 
      });
    }
    
    // Obter membros do grupo (limite para teste)
    let membros = await firebaseUtils.obterMembrosGrupo(grupoId, 50);
    
    // Obter cargos do grupo
    const cargos = await firebaseUtils.obterCargosGrupo(grupoId);
    
    // Preparar resposta
    const resposta = {
      success: true,
      grupo: {
        id: grupoInfo.id,
        nome: grupoInfo.nome || 'Sem nome',
        descricao: grupoInfo.descricao || 'Sem descrição',
        donoId: grupoInfo.donoId || 'Desconhecido',
        donoTag: grupoInfo.donoTag || 'Desconhecido',
        totalMembros: grupoInfo.totalMembros || 0,
        totalContribuicoes: grupoInfo.totalContribuicoes || 0,
        nivel: grupoInfo.nivel || 1,
        xp: grupoInfo.xp || 0,
        privacidade: grupoInfo.privacidade || 'publico',
        criadoEm: grupoInfo.criadoEm || new Date().toISOString()
      },
      cargos: cargos.map(cargo => ({
        nome: cargo.nome,
        nivel: cargo.nivel,
        sistema: cargo.sistema || false,
        membros: cargo.membros || 0
      })),
      membros: membros.map(membro => ({
        usuarioId: membro.usuarioId || 'Desconhecido',
        cargo: membro.cargo || 'Membro',
        nivel: membro.nivel || 1,
        contribuicao: membro.contribuicao || 0,
        xp: membro.xp || 0,
        entrouEm: membro.entrouEm || new Date().toISOString(),
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
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ... (mantenha as outras rotas como estão)

// 🔥 CORREÇÃO 5: WebSocket - verificar se está conectando
io.on('connection', (socket) => {
  console.log(`[Socket] Novo cliente conectado: ${socket.id}`);
  
  socket.on('authenticate', (data) => {
    console.log(`[Socket] Tentativa de autenticação: ${socket.id}`);
    
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
  
  socket.on('disconnect', () => {
    connectedClients.delete(socket.id);
    console.log(`[Socket] Cliente desconectado: ${socket.id}`);
  });
});

// 🔥 CORREÇÃO 6: Error handlers DEVEM SER OS ÚLTIMOS
app.use((req, res, next) => {
  console.log(`[404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Rota ${req.originalUrl} não encontrada`,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR] Erro global:', err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 🔥 CORREÇÃO 7: Iniciar servidor CORRETAMENTE
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Servidor rodando!
  📍 Porta: ${PORT}
  🌐 URL: http://0.0.0.0:${PORT}
  📅 ${new Date().toLocaleString()}
  
  🔗 Endpoints disponíveis:
  • GET  /               → Status geral
  • GET  /health         → Health check (Render)
  • GET  /api/status     → Status da API
  • GET  /api/grupo/:id  → Informações do grupo
  • GET  /api/membro/:id → Informações do membro
  
  🔐 API Key: ${API_KEY ? '✅ Configurada' : '❌ Não configurada'}
  🔌 Socket.io: ws://0.0.0.0:${PORT}
  `);
  
  // Log para debug
  console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
  console.log('[DEBUG] API_KEY length:', API_KEY ? API_KEY.length : 0);
});