// roblox-api.js
const axios = require('axios');

class RobloxAPI {
  constructor() {
    this.baseURL = 'http://localhost:3000'; // URL do seu servidor
    this.apiKey = 'SYSTEM_BY_NIKI';
  }
  
  // Método para testar conexão
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/api/status`);
      return {
        success: true,
        status: response.data.status,
        version: response.data.version
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Obter informações do grupo
  async getGrupoInfo(grupoId, filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.nivelMinimo) params.append('nivelMinimo', filters.nivelMinimo);
      if (filters.nivelMaximo) params.append('nivelMaximo', filters.nivelMaximo);
      
      const response = await axios.get(
        `${this.baseURL}/api/grupo/${grupoId}?${params.toString()}`,
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );
      
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  // Buscar grupo por nome
  async searchGrupo(nome, limite = 10) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/buscar-grupo?nome=${encodeURIComponent(nome)}&limite=${limite}`,
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );
      
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  // Obter informações do membro
  async getMembroInfo(usuarioId, grupoId = null) {
    try {
      let url = `${this.baseURL}/api/membro/${usuarioId}`;
      if (grupoId) {
        url += `?grupoId=${grupoId}`;
      }
      
      const response = await axios.get(url, {
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  // Obter ranking
  async getRanking(tipo = 'membros', limite = 10) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/ranking?tipo=${tipo}&limite=${limite}`,
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );
      
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  // Socket.io para atualizações em tempo real
  setupRealtimeUpdates(socketUrl = 'http://localhost:3000') {
    // Esta função seria usada no lado do Roblox via HTTPService
    // Implementação depende da biblioteca de WebSocket usada no Roblox
    console.log('Configurar WebSocket em:', socketUrl);
    
    return {
      connect: () => {
        console.log('Conectando ao WebSocket...');
        // Implementação de conexão WebSocket
      },
      subscribeToGroup: (grupoId) => {
        console.log(`Inscrito no grupo: ${grupoId}`);
        // Implementação de inscrição
      }
    };
  }
  
  // Gerar dados formatados para Roblox (estrutura simplificada)
  formatForRoblox(grupoData) {
    if (!grupoData.success) return grupoData;
    
    return {
      Grupo: {
        Id: grupoData.grupo.id,
        Nome: grupoData.grupo.nome,
        Descricao: grupoData.grupo.descricao,
        DonoId: grupoData.grupo.donoId,
        DonoTag: grupoData.grupo.donoTag,
        TotalMembros: grupoData.grupo.totalMembros,
        TotalContribuicoes: grupoData.grupo.totalContribuicoes,
        Nivel: grupoData.grupo.nivel,
        XP: grupoData.grupo.xp,
        Privacidade: grupoData.grupo.privacidade,
        CriadoEm: grupoData.grupo.criadoEm
      },
      Cargos: grupoData.cargos.map(cargo => ({
        Nome: cargo.nome,
        Nivel: cargo.nivel,
        Sistema: cargo.sistema,
        Membros: cargo.membros
      })),
      Membros: grupoData.membros.map(membro => ({
        UsuarioId: membro.usuarioId,
        Cargo: membro.cargo,
        Nivel: membro.nivel,
        Contribuicao: membro.contribuicao,
        XP: membro.xp,
        EntrouEm: membro.entrouEm,
        Ativo: membro.ativo
      })),
      Estatisticas: grupoData.estatisticas,
      Timestamp: grupoData.timestamp
    };
  }
}

module.exports = new RobloxAPI();