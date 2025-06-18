frappe.ui.form.on("Supplier Quotation", {
    validate: function(frm) {
        frm.doc.items.forEach(item => {
            if (item.rate <= 0) {
                frappe.throw(`Item rate cannot be negative for item: ${item.item_code}`);
            }
        });
    }
});
