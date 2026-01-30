// firebase-utils.js
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit 
} = require('firebase/firestore');

// Configuração do Firebase (use suas credenciais)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔧 FUNÇÕES UTILITÁRIAS

// Obter grupo por ID
async function obterGrupoPorId(grupoId) {
  try {
    const grupoDoc = await getDoc(doc(db, 'grupos', grupoId));
    
    if (!grupoDoc.exists()) {
      return null;
    }
    
    return { id: grupoDoc.id, ...grupoDoc.data() };
  } catch (error) {
    console.error('Erro ao obter grupo:', error);
    throw error;
  }
}

// Obter membros do grupo
async function obterMembrosGrupo(grupoId, maxLimit = 1000) {
  try {
    const q = query(
      collection(db, 'membros_grupos'),
      where('grupoId', '==', grupoId),
      where('ativo', '==', true),
      limit(maxLimit)
    );
    
    const snapshot = await getDocs(q);
    const membros = [];
    
    snapshot.forEach(doc => {
      membros.push({ id: doc.id, ...doc.data() });
    });
    
    return membros;
  } catch (error) {
    console.error('Erro ao obter membros:', error);
    return [];
  }
}

// Obter cargos do grupo
async function obterCargosGrupo(grupoId) {
  try {
    const cargosRef = collection(db, 'grupos', grupoId, 'cargos');
    const snapshot = await getDocs(cargosRef);
    
    const cargos = [
      { nome: 'Dono', nivel: 100, sistema: true, membros: 1 }
    ];
    
    let temCargoMembro = false;
    const cargosPersonalizados = [];
    
    snapshot.forEach(doc => {
      const cargoData = doc.data();
      cargosPersonalizados.push({ 
        id: doc.id, 
        ...cargoData,
        sistema: false 
      });
      
      if (cargoData.baseadoEm === 'Membro') {
        temCargoMembro = true;
      }
    });
    
    if (!temCargoMembro) {
      cargos.push({ nome: 'Membro', nivel: 1, sistema: true, membros: 0 });
    }
    
    cargos.push(...cargosPersonalizados);
    
    // Contar membros por cargo
    const membros = await obterMembrosGrupo(grupoId);
    const contagem = {};
    
    membros.forEach(membro => {
      const cargo = membro.cargo || 'Membro';
      contagem[cargo] = (contagem[cargo] || 0) + 1;
    });
    
    // Atualizar contagem nos cargos
    cargos.forEach(cargo => {
      cargo.membros = contagem[cargo.nome] || 0;
    });
    
    return cargos.sort((a, b) => b.nivel - a.nivel);
  } catch (error) {
    console.error('Erro ao obter cargos:', error);
    return [
      { nome: 'Dono', nivel: 100, sistema: true, membros: 1 },
      { nome: 'Membro', nivel: 1, sistema: true, membros: 0 }
    ];
  }
}

// Buscar grupos por nome
async function buscarGruposPorNome(nomeBusca, limite = 10) {
  try {
    // Nota: Firestore não suporta LIKE. Esta é uma implementação básica.
    // Para busca avançada, considere usar Algolia ou ElasticSearch
    
    const gruposRef = collection(db, 'grupos');
    const q = query(
      gruposRef,
      where('ativo', '==', true),
      orderBy('nome'),
      limit(limite * 5) // Pega mais para filtrar localmente
    );
    
    const snapshot = await getDocs(q);
    const grupos = [];
    
    snapshot.forEach(doc => {
      const grupo = doc.data();
      if (grupo.nome.toLowerCase().includes(nomeBusca.toLowerCase())) {
        grupos.push({ id: doc.id, ...grupo });
      }
    });
    
    return grupos.slice(0, limite);
  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return [];
  }
}

// Obter membro em um grupo específico
async function obterMembroNoGrupo(grupoId, usuarioId) {
  try {
    const membroId = `${grupoId}_${usuarioId}`;
    const membroDoc = await getDoc(doc(db, 'membros_grupos', membroId));
    
    if (!membroDoc.exists()) {
      return null;
    }
    
    return { id: membroDoc.id, ...membroDoc.data() };
  } catch (error) {
    console.error('Erro ao obter membro:', error);
    return null;
  }
}

// Obter todos os grupos de um membro
async function obterGruposDoMembro(usuarioId) {
  try {
    const q = query(
      collection(db, 'membros_grupos'),
      where('usuarioId', '==', usuarioId),
      where('ativo', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const grupos = [];
    
    for (const doc of snapshot.docs) {
      const membroData = doc.data();
      const grupoInfo = await obterGrupoPorId(membroData.grupoId);
      
      if (grupoInfo) {
        grupos.push({
          grupoId: membroData.grupoId,
          grupoNome: grupoInfo.nome,
          cargo: membroData.cargo,
          nivel: membroData.nivel || 1,
          contribuicao: membroData.contribuicao || 0,
          xp: membroData.xp || 0,
          entrouEm: membroData.entrouEm,
          ativo: membroData.ativo !== false
        });
      }
    }
    
    return grupos;
  } catch (error) {
    console.error('Erro ao obter grupos do membro:', error);
    return [];
  }
}

// Ranking por membros
async function getRankingPorMembros(limite = 10) {
  try {
    const gruposRef = collection(db, 'grupos');
    const q = query(
      gruposRef,
      where('ativo', '==', true),
      orderBy('totalMembros', 'desc'),
      limit(limite)
    );
    
    const snapshot = await getDocs(q);
    const ranking = [];
    
    snapshot.forEach(doc => {
      ranking.push({ id: doc.id, ...doc.data() });
    });
    
    return ranking;
  } catch (error) {
    console.error('Erro ao obter ranking por membros:', error);
    return [];
  }
}

// Ranking por contribuições
async function getRankingPorContribuicoes(limite = 10) {
  try {
    const gruposRef = collection(db, 'grupos');
    const q = query(
      gruposRef,
      where('ativo', '==', true),
      orderBy('totalContribuicoes', 'desc'),
      limit(limite)
    );
    
    const snapshot = await getDocs(q);
    const ranking = [];
    
    snapshot.forEach(doc => {
      ranking.push({ id: doc.id, ...doc.data() });
    });
    
    return ranking;
  } catch (error) {
    console.error('Erro ao obter ranking por contribuições:', error);
    return [];
  }
}

// Ranking por nível
async function getRankingPorNivel(limite = 10) {
  try {
    const gruposRef = collection(db, 'grupos');
    const q = query(
      gruposRef,
      where('ativo', '==', true),
      orderBy('nivel', 'desc'),
      limit(limite)
    );
    
    const snapshot = await getDocs(q);
    const ranking = [];
    
    snapshot.forEach(doc => {
      ranking.push({ id: doc.id, ...doc.data() });
    });
    
    return ranking;
  } catch (error) {
    console.error('Erro ao obter ranking por nível:', error);
    return [];
  }
}

module.exports = {
  obterGrupoPorId,
  obterMembrosGrupo,
  obterCargosGrupo,
  buscarGruposPorNome,
  obterMembroNoGrupo,
  obterGruposDoMembro,
  getRankingPorMembros,
  getRankingPorContribuicoes,
  getRankingPorNivel
};