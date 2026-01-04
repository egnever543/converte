export default {
	// Constantes da Evolution API (centralizadas)
	EVOLUTION_URL: 'https://evolution-evolution-api.htbm6j.easypanel.host',
	EVOLUTION_API_KEY: '429683C4C977415CAAFCCE10F7D57E11',
	
	// Pegar credenciais do Chatwoot do usuário logado
	getChatwootConfig: () => {
		const userData = getUserData.data[0];
		if (!userData) {
			throw new Error('Dados do usuário não encontrados');
		}
		
		return {
			url: 'https://convertechat.com.br',
			token: userData.token_chatwoot,
			accountId: userData.id_chatwoot
		};
	},
	
	// ============================================
	// LISTAR INSTÂNCIAS
	// ============================================
	
	getAllInstances: async () => {
		try {
			showAlert('Carregando instâncias...', 'info');
			
			// Buscar dados do Chatwoot e Evolution
			const [chatwootResult, evolutionResult] = await Promise.all([
				listChatwootInboxes.run(),
				listEvolutionInstances.run()
			]);
			
			const chatwootInboxes = chatwootResult.payload || chatwootResult;
			const evolutionInstances = Array.isArray(evolutionResult) ? evolutionResult : [];
			
			// Combinar dados
			const instances = chatwootInboxes.map(inbox => {
				const evolutionInstance = evolutionInstances.find(evo => {
					const evoData = evo.instance || evo;
					const evoName = evoData.instanceName || evoData.name;
					return evoName === inbox.name;
				});
				
				if (evolutionInstance) {
					const evoData = evolutionInstance.instance || evolutionInstance;
					const status = evoData.status || evoData.connectionStatus || 'unknown';
					
					return {
						name: inbox.name,
						chatwoot_id: inbox.id,
						chatwoot_channel_type: inbox.channel_type,
						evolution_status: status,
						evolution_owner: evoData.owner || null,
						evolution_profile_name: evoData.profileName || null,
						evolution_profile_picture: evoData.profilePictureUrl || null,
						connected: status === 'open',
						has_evolution: true
					};
				} else {
					return {
						name: inbox.name,
						chatwoot_id: inbox.id,
						chatwoot_channel_type: inbox.channel_type,
						evolution_status: 'not_found',
						evolution_owner: null,
						evolution_profile_name: null,
						evolution_profile_picture: null,
						connected: false,
						has_evolution: false
					};
				}
			});
			
			// Salvar no store para usar na table
			await storeValue('instances', instances);
			
			showAlert(`${instances.length} instância(s) encontrada(s)`, 'success');
			return instances;
			
		} catch (error) {
			console.error('Erro ao buscar instâncias:', error);
			showAlert('Erro ao buscar instâncias: ' + error.message, 'error');
			return [];
		}
	},
	
	// ============================================
	// CRIAR INSTÂNCIA
	// ============================================
	
	createInstance: async (instanceName) => {
		try {
			if (!instanceName || instanceName.trim() === '') {
				showAlert('Digite um nome para a instância', 'warning');
				return;
			}
			
			showAlert('Criando instância...', 'info');
			
			const result = await createEvolutionInstance.run({
				instanceName: instanceName.trim()
			});
			
			if (result) {
				showAlert('Instância criada! A inbox no Chatwoot foi criada automaticamente.', 'success');
				
				// Recarregar lista
				await this.getAllInstances();
				
				// Limpar input
				resetWidget('inp_newInstanceName');
			}
			
		} catch (error) {
			console.error('Erro ao criar instância:', error);
			showAlert('Erro ao criar instância: ' + error.message, 'error');
		}
	},
	
	// ============================================
	// DELETAR INSTÂNCIA
	// ============================================
	
	deleteInstance: async (instanceName, chatwootInboxId) => {
		try {
			const confirmed = await showModal('mdl_confirmDelete');
			if (!confirmed) return;
			
			showAlert('Deletando instância...', 'info');
			
			let errors = [];
			let successCount = 0;
			
			// Deletar da Evolution
			try {
				await deleteEvolutionInstance.run({
					instanceName: instanceName
				});
				successCount++;
			} catch (error) {
				errors.push('Evolution: ' + error.message);
			}
			
			// Deletar do Chatwoot
			if (chatwootInboxId) {
				try {
					await deleteChatwootInbox.run({
						inboxId: chatwootInboxId
					});
					successCount++;
				} catch (error) {
					errors.push('Chatwoot: ' + error.message);
				}
			}
			
			if (successCount > 0) {
				const msg = errors.length > 0 
					? `Instância deletada com avisos: ${errors.join(', ')}`
					: 'Instância deletada com sucesso!';
				showAlert(msg, errors.length > 0 ? 'warning' : 'success');
				
				// Recarregar lista
				await this.getAllInstances();
			} else {
				showAlert('Erro ao deletar: ' + errors.join(', '), 'error');
			}
			
		} catch (error) {
			console.error('Erro ao deletar instância:', error);
			showAlert('Erro ao deletar instância: ' + error.message, 'error');
		}
	},
	
	// ============================================
	// REINICIAR INSTÂNCIA
	// ============================================
	
	restartInstance: async (instanceName) => {
		try {
			showAlert('Reiniciando instância...', 'info');
			
			await restartEvolutionInstance.run({
				instanceName: instanceName
			});
			
			showAlert('Instância reiniciada com sucesso!', 'success');
			
			// Recarregar após 2 segundos
			setTimeout(() => {
				this.getAllInstances();
			}, 2000);
			
		} catch (error) {
			console.error('Erro ao reiniciar instância:', error);
			showAlert('Erro ao reiniciar instância: ' + error.message, 'error');
		}
	},
	
	// ============================================
	// BUSCAR QR CODE
	// ============================================
	
	getQRCode: async (instanceName) => {
	try {
		showAlert('📱 Buscando QR Code...', 'info');
		
		const result = await getInstanceQRCode.run({
			instanceName: instanceName
		});
		
		if (result && result.base64) {
			// Salvar no store
			await storeValue('currentQRCode', result.base64);
			await storeValue('currentInstanceName', instanceName);
			
			// Abrir modal
			showModal('mdl_qrCode');
			showAlert('✅ QR Code obtido! Escaneie para conectar.', 'success');
			
		} else if (result && result.code === 'INSTANCE_ALREADY_CONNECTED') {
			showAlert('✅ Instância já está conectada!', 'success');
			
		} else if (result && result.message) {
			showAlert('⚠️ ' + result.message, 'warning');
			
		} else {
			showAlert('⚠️ QR Code não disponível', 'warning');
		}
		
	} catch (error) {
		console.error('Erro ao buscar QR Code:', error);
		showAlert('❌ Erro ao buscar QR Code: ' + error.message, 'error');
	}
},
	
	// ============================================
	// HELPERS
	// ============================================
	
	getStatusColor: (status) => {
		const colors = {
			'open': '#22c55e',      // verde
			'connecting': '#f59e0b', // amarelo
			'close': '#ef4444',      // vermelho
			'unknown': '#6b7280',    // cinza
			'not_found': '#6b7280'   // cinza
		};
		return colors[status] || '#6b7280';
	},
	
	getStatusText: (status) => {
		const texts = {
			'open': '✅ Conectado',
			'connecting': '🔄 Conectando',
			'close': '❌ Desconectado',
			'unknown': '❓ Desconhecido',
			'not_found': '⚠️ Não encontrado'
		};
		return texts[status] || '❓ Desconhecido';
	}
}