export default {
	supabaseConfig: {
		url: 'https://ia-supabase.htbm6j.easypanel.host/rest/v1',
		apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
		authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
	},

	// Função auxiliar para atualizar usuário no Supabase
	updateUserSupabase: async (email, updateData) => {
		try {
			const response = await fetch(
				`${this.supabaseConfig.url}/cadastros?email=eq.${encodeURIComponent(email)}`,
				{
					method: 'PATCH',
					headers: {
						'apikey': this.supabaseConfig.apikey,
						'Authorization': `Bearer ${this.supabaseConfig.authToken}`,
						'Content-Type': 'application/json',
						'Prefer': 'return=representation'
					},
					body: JSON.stringify(updateData)
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error updating user in Supabase:', error);
			throw error;
		}
	},

	// Função auxiliar para buscar usuário por email
	getUserByEmailSupabase: async (email) => {
		try {
			const response = await fetch(
				`${this.supabaseConfig.url}/cadastros?email=eq.${encodeURIComponent(email)}&select=*`,
				{
					method: 'GET',
					headers: {
						'apikey': this.supabaseConfig.apikey,
						'Authorization': `Bearer ${this.supabaseConfig.authToken}`,
						'Content-Type': 'application/json'
					}
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error fetching user from Supabase:', error);
			throw error;
		}
	},

	checkAuth: async () => {
		const token = appsmith.store.token;
		
		if (!token) {
			navigateTo('Authentication');
			showAlert('Please login first', 'warning');
			return false;
		}
		
		// Verificar e criar customer no Asaas se necessário
		this.ensureAsaasCustomer();
		
		return true;
	},
	
	// Garantir que o customer existe no Asaas
	ensureAsaasCustomer: async () => {
		try {
			const user = this.getUser();
			
			if (!user || !user.email) {
				console.log('❌ Dados do usuário inválidos');
				return null;
			}

			// Buscar dados do usuário no Supabase
			const userData = await this.getUserByEmailSupabase(user.email);
			
			if (!userData || userData.length === 0) {
				console.log('❌ Nenhum dado do usuário encontrado');
				return null;
			}
			
			const userInfo = userData[0];
			
			// Se já tem customer_id, não faz nada
			if (userInfo?.asaas_customer_id) {
				console.log('✅ Customer Asaas já existe:', userInfo.asaas_customer_id);
				return userInfo.asaas_customer_id;
			}

			// Se não tem, criar agora (cliente antigo)
			console.log('⚠️ Cliente antigo detectado! Criando customer no Asaas...');
			
			// Criar customer no Asaas
			const customer = await createAsaasCustomer.run({
				name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0],
				email: user.email,
				cpfCnpj: "00000000000",
				mobilePhone: "00000000000"
			});
			
			console.log('✅ Cliente Asaas criado:', customer);
			
			// Atualizar no Supabase
			await this.updateUserSupabase(user.email, {
				asaas_customer_id: customer.id,
				payment_day: '10',
				payment_status: "Não configurado"
			});
			
			console.log('✅ Dados atualizados no Supabase');
			showAlert('Cadastro de pagamento configurado!', 'success');
			
			return customer.id;
		} catch (error) {
			console.error('❌ Erro ao verificar/criar customer:', error);
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