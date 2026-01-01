export default {
	
	generateCharge: async () => {
		try {
			// Verificar se já tem customer_id
			let customerId = getUserData.data[0]?.asaas_customer_id;
			
			if (!customerId) {
				showAlert("Criando cadastro...", "info");
				const customer = await createAsaasCustomer.run();
				customerId = customer.id;
				
				await updateUserIntegrations.run({
					asaas_customer_id: customerId
				});
				
				await getUserData.run();
			}

			// Criar cobrança
			showAlert("Gerando cobrança...", "info");
			const charge = await createMonthlyCharge.run();

			// Atualizar planilha
			await updateUserIntegrations.run({
				payment_status: "Pendente"
			});

			await getUserData.run();

			// Abrir boleto/PIX
			// Abrir boleto/PIX
if (charge.invoiceUrl) {
  navigateTo(charge.invoiceUrl, {}, 'NEW_WINDOW');
}
if (charge.bankSlipUrl) {
  navigateTo(charge.bankSlipUrl, {}, 'NEW_WINDOW');
}

			showAlert("Cobrança gerada! Confira seu email.", "success");

		} catch (error) {
			console.error(error);
			showAlert("Erro: " + (error.message || "Erro ao gerar cobrança"), "error");
		}
	},

	verifyStatus: async () => {
		try {
			const payments = await checkPayment.run();
			
			if (payments.data && payments.data.length > 0) {
				const lastPayment = payments.data[0];
				
				let status = "Pendente";
				if (lastPayment.status === "RECEIVED" || lastPayment.status === "CONFIRMED") {
					status = "Pago";
				} else if (lastPayment.status === "OVERDUE") {
					status = "Vencido";
				}

				await updateUserIntegrations.run({
					payment_status: status,
					last_payment_date: lastPayment.paymentDate || lastPayment.confirmedDate || null
				});

				await getUserData.run();
				showAlert("Status: " + status, status === "Pago" ? "success" : "info");
			} else {
				showAlert("Nenhum pagamento encontrado", "info");
			}

		} catch (error) {
			console.error(error);
			showAlert("Erro ao verificar", "error");
		}
	}
}