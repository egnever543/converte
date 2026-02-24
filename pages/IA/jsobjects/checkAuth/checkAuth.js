export default {
	checkAuth: async () => {
		const token = appsmith.store.token;
		if (!token) {
			navigateTo('Login');
			showAlert('Faça login para acessar', 'warning');
		}
	}
}