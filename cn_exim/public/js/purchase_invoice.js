frappe.ui.form.on("Purchase Invoice", {
    supplier: function (frm) {
        frm.set_query('custom_purchase_receipt', function () {
            return {
                filters: {
                    'supplier': frm.doc.supplier,
                    'docstatus': 1
                }
            };
        });
    }
});
