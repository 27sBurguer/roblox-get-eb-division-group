// firebase-utils.js - Versão simplificada para teste
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

// Configuração do Firebase com fallback
let db;
try {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('[Firebase] ✅ Conectado com sucesso');
} catch (error) {
  console.error('[Firebase] ❌ Erro na conexão:', error.message);
  db = null;
}

// Obter grupo por ID
async function obterGrupoPorId(grupoId) {
  try {
    if (!db) {
      console.log('[Firebase] ❌ Banco não conectado, retornando mock');
      return mockGrupo(grupoId);
    }
    
    const grupoDoc = await getDoc(doc(db, 'grupos', grupoId));
    
    if (!grupoDoc.exists()) {
      console.log(`[Firebase] Grupo ${grupoId} não encontrado`);
      return null;
    }
    
    return { id: grupoDoc.id, ...grupoDoc.data() };
  } catch (error) {
    console.error('[Firebase] Erro ao obter grupo:', error.message);
    return mockGrupo(grupoId); // Fallback para teste
  }
}

// Obter membros do grupo
async function obterMembrosGrupo(grupoId, maxLimit = 50) {
  try {
    if (!db) {
      console.log('[Firebase] ❌ Banco não conectado, retornando mock');
      return mockMembros();
    }
    
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
    
    console.log(`[Firebase] ${membros.length} membros encontrados`);
    return membros;
  } catch (error) {
    console.error('[Firebase] Erro ao obter membros:', error.message);
    return mockMembros(); // Fallback para teste
  }
}

// Funções de mock para teste
function mockGrupo(grupoId) {
  return {
    id: grupoId,
    nome: "Grupo de Teste " + grupoId.substring(0, 8),
    descricao: "Grupo mock para testes",
    donoId: "123456789",
    donoTag: "DonoTeste#1234",
    totalMembros: 25,
    totalContribuicoes: 5000,
    nivel: 3,
    xp: 750,
    privacidade: "publico",
    criadoEm: new Date().toISOString()
  };
}

function mockMembros() {
  const membros = [];
  for (let i = 1; i <= 10; i++) {
    membros.push({
      usuarioId: `user${i}_${Date.now()}`,
      cargo: i === 1 ? 'Dono' : (i <= 3 ? 'Admin' : 'Membro'),
      nivel: i === 1 ? 100 : (i <= 3 ? 50 : 1),
      contribuicao: i * 100,
      xp: i * 50,
      entrouEm: new Date().toISOString(),
      ativo: true
    });
  }
  return membros;
}

// Obter cargos do grupo (mock para teste)
async function obterCargosGrupo(grupoId) {
  return [
    { nome: 'Dono', nivel: 100, sistema: true, membros: 1 },
    { nome: 'Admin', nivel: 50, sistema: false, membros: 2 },
    { nome: 'Membro', nivel: 1, sistema: true, membros: 7 }
  ];
}

module.exports = {
  obterGrupoPorId,
  obterMembrosGrupo,
  obterCargosGrupo
};