export default {
	checkAuth: async () => {
		const token = appsmith.store.token;
		
		if (!token) {
			navigateTo('Authentication');
			showAlert('Please login first', 'warning');
			return false;
		}
		
		return true;
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