export default {
	defaultTab: 'Sign In',

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

	// NOVA FUNÇÃO - Criar cliente no Asaas
	createAsaasCustomerOnRegister: async (email, firstName, lastName) => {
		try {
			// CPF e telefone fictícios por enquanto
			const customer = await createAsaasCustomer.run({
				name: `${firstName} ${lastName}`,
				email: email,
				cpfCnpj: "00000000000", // Será atualizado depois
				mobilePhone: "00000000000" // Será atualizado depois
			});
			
			console.log('Asaas customer created:', customer);
			return customer.id;
		} catch (error) {
			console.error('Error creating Asaas customer:', error);
			// Não falhar o registro se der erro no Asaas
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

			const result = await findUserByEmail.run();
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

			if (!firstName || !lastName || !email || !password) {
				showAlert('Por favor, preencha todos os campos', 'warning');
				return;
			}

			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				showAlert('Por favor, insira um email válido', 'warning');
				return;
			}

			if (password.length < 6) {
				showAlert('A senha deve ter no mínimo 6 caracteres', 'warning');
				return;
			}

			const passwordHash = await this.generatePasswordHash();
			console.log('Hash generated, creating user...');
			
			// NOVO: Criar cliente no Asaas
			const asaasCustomerId = await this.createAsaasCustomerOnRegister(email, firstName, lastName);
			
			// Criar usuário nas duas planilhas
			const [result1, result2] = await Promise.all([
				createUser.run({passwordHash}),
				createUser2.run({
					passwordHash,
					asaasCustomerId: asaasCustomerId,
					paymentDay: 10 // Dia padrão de vencimento
				})
			]);
			
			console.log('User creation result 1:', result1);
			console.log('User creation result 2:', result2);
			
			if (result1 || result2) {
				const userPayload = {
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
			showAlert('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'), 'error');
		}
	}
}