export default {
	checkAuth: async () => {
		const token = appsmith.store.token;
		
		if (!token) {
			navigateTo('Authentication');
			showAlert('Please login first', 'warning');
			return false;
		}
		
		// NOVO: Verificar e criar customer no Asaas se necessário
		this.ensureAsaasCustomer();
		
		return true;
	},
	
	// NOVA FUNÇÃO: Garantir que o customer existe no Asaas
	ensureAsaasCustomer: async () => {
		try {
			// Aguardar um pouco para getUserData carregar
			await new Promise(resolve => setTimeout(resolve, 500));
			
			const userData = getUserData.data;
			
			// Verificar se getUserData retornou dados
			if (!userData || userData.length === 0) {
				console.log('Nenhum dado do usuário encontrado');
				return;
			}
			
			const userInfo = userData[0];
			
			// Se já tem customer_id, não faz nada
			if (userInfo?.asaas_customer_id) {
				console.log('✅ Customer Asaas já existe:', userInfo.asaas_customer_id);
				return userInfo.asaas_customer_id;
			}

			// Se não tem, criar agora (cliente antigo)
			console.log('⚠️ Cliente antigo detectado! Criando customer no Asaas...');
			const user = this.getUser();
			
			if (!user || !user.email) {
				console.error('❌ Dados do usuário inválidos');
				return null;
			}

			// Criar customer no Asaas
			const customer = await createAsaasCustomer.run({
				name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0],
				email: user.email,
				cpfCnpj: "00000000000", // Será preenchido depois
				mobilePhone: "00000000000" // Será preenchido depois
			});

			console.log('✅ Cliente Asaas criado:', customer);

			// Salvar na planilha
			await updateUserIntegrations.run({
				asaas_customer_id: customer.id,
				payment_day: 10, // Dia padrão de vencimento
				payment_status: "Não configurado"
			});

			// Recarregar dados do usuário
			await getUserData.run();

			console.log('✅ Dados atualizados na planilha');
			showAlert('Cadastro de pagamento configurado!', 'success');
			
			return customer.id;

		} catch (error) {
			console.error('❌ Erro ao verificar/criar customer:', error);
			// Não mostrar erro pro usuário, apenas logar
			// O customer será criado quando ele tentar gerar a cobrança
			console.log('Customer será criado na primeira cobrança');
			return null;
		}
	},
	
	logout: async () => {
		await storeValue('token', null);
		navigateTo('Authentication');
		showAlert('Logged out successfully', 'success');
	},
	
	getUser: () => {
		const token = appsmith.store.token;
		if (token) {
			try {
				return jsonwebtoken.decode(token);
			} catch (e) {
				return null;
			}
		}
		return null;
	}
}