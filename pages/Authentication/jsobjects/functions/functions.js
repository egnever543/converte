export default {
	defaultTab: 'Sign In',

	setDefaultTab: (newTab) => {
		this.defaultTab = newTab;
	},

	generatePasswordHash: async () => {
		return dcodeIO.bcrypt.hashSync(inp_registerPassword.text, 10);
	},

	verifyHash: async (password, hash) => {
		return dcodeIO.bcrypt.compareSync(password, hash);
	},

	createToken: async (user) => {
		return jsonwebtoken.sign(user, 'secret', {expiresIn: 60*60});
	},

	signIn: async () => {
		const password = inp_password.text;
		const users = await findUserByEmail.run();

		if (users && users.length > 0) {
			const user = users[0];
			if (await this.verifyHash(password, user?.password_hash)) {
				await storeValue('token', await this.createToken(user));
				showAlert('Login successful!', 'success');
				navigateTo('Dashboard');
			} else {
				return showAlert('Invalid email/password combination', 'error');
			}
		} else {
			return showAlert('Invalid email/password combination', 'error');
		}
	},

	register: async () => {
		const passwordHash = await this.generatePasswordHash();
		
		try {
			const result = await createUser.run({passwordHash});
			if (result) {
				const user = {
					first_name: inp_firstName.text,
					last_name: inp_lastName.text,
					email: inp_registerEmail.text,
					role: 'Admin'
				};
				await storeValue('token', await this.createToken(user));
				showAlert('Registration successful!', 'success');
				navigateTo('Dashboard');
			}
		} catch (error) {
			console.error(error);
			return showAlert('Error creating account', 'error');
		}
	}
}