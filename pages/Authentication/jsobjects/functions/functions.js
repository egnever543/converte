export default {
	defaultTab: 'Sign In',

	supabaseConfig: {
		url: 'https://ia-supabase.htbm6j.easypanel.host/rest/v1',
		apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE',
		authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE'
	},

	findUserByEmailSupabase: async (email) => {
		try {
			const response = await fetch(
				`${this.supabaseConfig.url}/cadastros?email=eq.${encodeURIComponent(email)}&email=not.is.null&select=*`,
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

	createUserSupabase: async (userData) => {
		try {
			const response = await fetch(
				`${this.supabaseConfig.url}/cadastros`,
				{
					method: 'POST',
					headers: {
						'apikey': this.supabaseConfig.apikey,
						'Authorization': `Bearer ${this.supabaseConfig.authToken}`,
						'Content-Type': 'application/json',
						'Prefer': 'return=representation'
					},
					body: JSON.stringify(userData)
				}
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Supabase error response:', errorText);
				
				// Verificar se é erro de email duplicado
				if (errorText.includes('duplicate key') || errorText.includes('idx_cadastros_email_unique')) {
					throw new Error('Este email já está cadastrado');
				}
				
				// Verificar se é erro de id_chatwoot duplicado
				if (errorText.includes('id_chatwoot')) {
					throw new Error('Este ID Chatwoot já está cadastrado');
				}
				
				throw new Error(`Erro ao criar usuário: ${response.status}`);
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Error creating user in Supabase:', error);
			throw error;
		}
	},

	setDefaultTab: (newTab) => {
		this.defaultTab = newTab;
	},

	generatePasswordHash: async () => {
		try {
			const password = inp_registerPassword.text;
			if (!password) {
				throw new Error('Password is required');
			}
			return dcodeIO.bcrypt.hashSync(password, 10);
		} catch (error) {
			console.error('Error generating hash:', error);
			throw error;
		}
	},

	verifyHash: async (password, hash) => {
		try {
			if (!password || !hash) {
				return false;
			}
			return dcodeIO.bcrypt.compareSync(password, hash);
		} catch (error) {
			console.error('Error verifying hash:', error);
			return false;
		}
	},

	createToken: async (user) => {
		try {
			return jsonwebtoken.sign(user, 'secret', {expiresIn: 60*60});
		} catch (error) {
			console.error('Error creating token:', error);
			throw error;
		}
	},

	createAsaasCustomerOnRegister: async (email, firstName, lastName) => {
		try {
			const customer = await createAsaasCustomer.run({
				name: `${firstName} ${lastName}`,
				email: email,
				cpfCnpj: "00000000000",
				mobilePhone: "00000000000"
			});
			
			console.log('Asaas customer created:', customer);
			return customer.id;
		} catch (error) {
			console.error('Error creating Asaas customer:', error);
			return null;
		}
	},

	signIn: async () => {
		try {
			const email = inp_email.text;
			const password = inp_password.text;

			console.log('Attempting login with email:', email);

			if (!email || !password) {
				showAlert('Por favor, preencha todos os campos', 'warning');
				return;
			}

			const result = await this.findUserByEmailSupabase(email);
			console.log('Query result:', result);

			if (!result || result.length === 0) {
				showAlert('Email ou senha inválidos', 'error');
				return;
			}

			const user = result[0];
			console.log('User found:', { email: user.email, hasHash: !!user.password_hash });
			
			if (!user.password_hash) {
				showAlert('Erro nos dados do usuário. Senha não cadastrada.', 'error');
				return;
			}

			const isValid = await this.verifyHash(password, user.password_hash);
			console.log('Password valid:', isValid);
			
			if (isValid) {
				const userPayload = {
					id_chatwoot: user.id_chatwoot,
					first_name: user.first_name,
					last_name: user.last_name,
					email: user.email,
					role: user.role || 'Admin'
				};
				
				const token = await this.createToken(userPayload);
				await storeValue('token', token);
				showAlert('Login realizado com sucesso!', 'success');
				navigateTo('Dashboard');
			} else {
				showAlert('Email ou senha inválidos', 'error');
			}
		} catch (error) {
			console.error('Sign in error:', error);
			showAlert('Erro ao fazer login: ' + (error.message || 'Erro desconhecido'), 'error');
		}
	},

	register: async () => {
		try {
			const firstName = inp_firstName.text;
			const lastName = inp_lastName.text;
			const email = inp_registerEmail.text;
			const password = inp_registerPassword.text;
			const idChatwoot = inp_id_chatwoot.text; // NOVO CAMPO

			// Validação de campos obrigatórios
			if (!firstName || !lastName || !email || !password || !idChatwoot) {
				showAlert('Por favor, preencha todos os campos', 'warning');
				return;
			}

			// Validação de email
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				showAlert('Por favor, insira um email válido', 'warning');
				return;
			}

			// Validação de senha
			if (password.length < 6) {
				showAlert('A senha deve ter no mínimo 6 caracteres', 'warning');
				return;
			}

			// Validação de ID Chatwoot (deve ser numérico)
			if (isNaN(idChatwoot) || idChatwoot <= 0) {
				showAlert('Por favor, insira um ID Chatwoot válido', 'warning');
				return;
			}

			// Verificar se email já existe
			const existingUser = await this.findUserByEmailSupabase(email);
			if (existingUser && existingUser.length > 0) {
				showAlert('Este email já está cadastrado', 'warning');
				return;
			}

			const passwordHash = await this.generatePasswordHash();
			console.log('Hash generated, creating user...');
			
			const asaasCustomerId = await this.createAsaasCustomerOnRegister(email, firstName, lastName);
			
			const userData = {
				id_chatwoot: parseInt(idChatwoot), // INCLUIR ID_CHATWOOT
				first_name: firstName,
				last_name: lastName,
				email: email,
				password_hash: passwordHash,
				role: 'Admin',
				asaas_customer_id: asaasCustomerId,
				payment_day: '10',
				status_ia: 'ativo',
				payment_status: 'Não configurado',
				created_at: new Date().toISOString()
			};

			const result = await this.createUserSupabase(userData);
			console.log('User creation result:', result);
			
			if (result && result.length > 0) {
				const userPayload = {
					id_chatwoot: result[0].id_chatwoot,
					first_name: firstName,
					last_name: lastName,
					email: email,
					role: 'Admin'
				};
				
				const token = await this.createToken(userPayload);
				await storeValue('token', token);
				showAlert('Registro realizado com sucesso!', 'success');
				navigateTo('Dashboard');
			} else {
				showAlert('Erro ao criar conta', 'error');
			}
		} catch (error) {
			console.error('Registration error:', error);
			
			// Mostrar mensagem de erro amigável
			if (error.message.includes('email já está cadastrado')) {
				showAlert(error.message, 'warning');
			} else if (error.message.includes('ID Chatwoot já está cadastrado')) {
				showAlert(error.message, 'warning');
			} else {
				showAlert('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'), 'error');
			}
		}
	}
}