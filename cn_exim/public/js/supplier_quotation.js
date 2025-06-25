frappe.ui.form.on("Supplier Quotation", {
    validate: function (frm) {
        frm.doc.items.forEach(item => {
            if (item.rate <= 0) {
                frappe.throw(`Item rate cannot be negative for item: ${item.item_code}`);
            }
        });
    },
    after_save:function(frm){
        frm.doc.items.forEach(item => {
            if (!item.lead_time_days && !item.custom_minimum_order_qty) {
                frm.call({
                    method: "cn_exim.config.py.supplier_quotation.get_details_to_item",
                    args: {
                        row_name: item.name,
                        item_code: item.item_code,
                        supplier: frm.doc.supplier,
                    },
                    callback: function (r) {
                    }
                })
            }
        })
    }
});
