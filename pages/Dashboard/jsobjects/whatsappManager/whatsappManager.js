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
		
		// Combinar dados e buscar settings
		const instancesPromises = chatwootInboxes.map(async inbox => {
			const evolutionInstance = evolutionInstances.find(evo => {
				const evoData = evo.instance || evo;
				const evoName = evoData.instanceName || evoData.name;
				return evoName === inbox.name;
			});
			
			if (evolutionInstance) {
				const evoData = evolutionInstance.instance || evolutionInstance;
				const status = evoData.status || evoData.connectionStatus || 'unknown';
				
				// Buscar settings da instância
				let groupsBlocked = null;
				try {
					const settings = await getInstanceSettings.run({
						instanceName: inbox.name
					});
					groupsBlocked = settings?.settings?.groupsIgnore || false;
				} catch (error) {
					console.warn(`Não foi possível buscar settings de ${inbox.name}:`, error);
				}
				
				return {
					name: inbox.name,
					chatwoot_id: inbox.id,
					chatwoot_channel_type: inbox.channel_type,
					evolution_status: status,
					evolution_owner: evoData.owner || null,
					evolution_profile_name: evoData.profileName || null,
					evolution_profile_picture: evoData.profilePictureUrl || null,
					connected: status === 'open',
					has_evolution: true,
					groups_blocked: groupsBlocked
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
					has_evolution: false,
					groups_blocked: null
				};
			}
		});
		
		const instances = await Promise.all(instancesPromises);
		
		// Salvar no store
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
			
			// DEBUG: Ver o que a API retornou
			console.log('🔍 RESPOSTA COMPLETA DA API:', JSON.stringify(result, null, 2));
			
			// Tentar diferentes formatos de resposta da Evolution API
			let base64Image = null;
			
			// Formato 1: {base64: "..."}
			if (result && result.base64) {
				base64Image = result.base64;
				console.log('✅ Formato 1: result.base64');
			}
			// Formato 2: {qrcode: {base64: "..."}}
			else if (result && result.qrcode && result.qrcode.base64) {
				base64Image = result.qrcode.base64;
				console.log('✅ Formato 2: result.qrcode.base64');
			}
			// Formato 3: {qr: {base64: "..."}}
			else if (result && result.qr && result.qr.base64) {
				base64Image = result.qr.base64;
				console.log('✅ Formato 3: result.qr.base64');
			}
			// Formato 4: String pura
			else if (typeof result === 'string' && result.startsWith('iVBOR')) {
				base64Image = result;
				console.log('✅ Formato 4: String pura');
			}
			// Formato 5: {pairingCode: "...", qr: {base64: "..."}}
			else if (result && result.qr) {
				base64Image = result.qr;
				console.log('✅ Formato 5: result.qr direto');
			}
			
			console.log('📷 Base64 extraído:', base64Image ? `${base64Image.substring(0, 50)}...` : 'NÃO ENCONTRADO');
			console.log('📏 Tamanho do base64:', base64Image ? base64Image.length : 0);
			
			if (base64Image && base64Image.length > 100) {
				// Salvar no store
				await storeValue('currentQRCode', base64Image);
				await storeValue('currentInstanceName', instanceName);
				
				console.log('💾 Salvou no store!');
				
				// Abrir modal
				showModal('mdl_qrCode');
				showAlert('✅ QR Code obtido! Escaneie para conectar.', 'success');
				
			} else if (result && result.code === 'INSTANCE_ALREADY_CONNECTED') {
				showAlert('✅ Instância já está conectada!', 'success');
				
			} else {
				console.error('❌ ERRO: Nenhum base64 válido encontrado');
				console.error('📋 Estrutura completa:', result);
				showAlert('⚠️ QR Code não disponível. Veja o console (F12) para detalhes.', 'warning');
			}
			
		} catch (error) {
			console.error('❌ Erro ao buscar QR Code:', error);
			showAlert('❌ Erro ao buscar QR Code: ' + error.message, 'error');
		}
	},
	
// ============================================
// TOGGLE BLOQUEIO DE GRUPOS
// ============================================

toggleBlockGroups: async (instanceName) => {
	try {
		showAlert('🔍 Verificando configurações...', 'info');
		
		// Buscar configurações atuais
		const settings = await getInstanceSettings.run({
			instanceName: instanceName
		});
		
		console.log('⚙️ Configurações atuais:', settings);
		
		// Verificar se grupos estão bloqueados
		const isBlocked = settings?.settings?.groupsIgnore === true;
		
		if (isBlocked) {
			// Desbloquear
			showAlert('🔓 Desbloqueando grupos...', 'info');
			await unblockGroups.run({
				instanceName: instanceName
			});
			showAlert('✅ Grupos desbloqueados com sucesso!', 'success');
		} else {
			// Bloquear
			showAlert('🚫 Bloqueando grupos...', 'info');
			await blockGroups.run({
				instanceName: instanceName
			});
			showAlert('✅ Grupos bloqueados com sucesso!', 'success');
		}
		
		// Recarregar lista para atualizar o status
		await this.getAllInstances();
		
	} catch (error) {
		console.error('Erro ao alternar bloqueio de grupos:', error);
		showAlert('❌ Erro: ' + error.message, 'error');
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