frappe.ui.form.on("Material Request", {
    validate: function (frm) {
        if (frm.doc.material_request_type == "Purchase") {
            let promises = [];

            frm.doc.items.forEach(item => {
                let p = frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Item",
                        filters: {
                            name: item.item_code
                        },
                        fieldname: ["min_order_qty"]
                    }
                }).then(r => {
                    if (r.message && item.qty < r.message.min_order_qty) {
                        frappe.msgprint(`Item ${item.item_code} has qty less than minimum order quantity (${r.message.min_order_qty}).`);
                        frappe.validated = false;
                    }
                });

                promises.push(p);
            });

            return Promise.all(promises);
        }
    }
})

frappe.ui.form.on("Material Request Item", {
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        row.custom_plant = frm.doc.custom_plant
    }
})