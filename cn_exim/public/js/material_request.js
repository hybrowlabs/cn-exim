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
    },
    refresh: function (frm){
        if (frm.doc.docstatus == 1 && frm.doc.material_request_type == "Purchase") {
            frm.remove_custom_button("Request for Quotation", "Create");
            frm.add_custom_button(__("Request for Quotations"), function(){
                frappe.call({
                    method: "cn_exim.config.py.material_request.create_rfqs",
                    args: {
                        doc: frm.doc
                    },
                    callback: function (r) {
                        if (r.message && r.message.rfqs && r.message.rfqs.length > 0) {
                            let rfq_list = r.message.rfqs.join(", ");
                            frappe.msgprint({
                                title: __('RFQs Created Successfully'),
                                message: rfq_list,
                                indicator: 'green'
                            });
                        } else {
                            frappe.msgprint({
                                title: __('No RFQs Created'),
                                message: __('No RFQs were created.'),
                                indicator: 'orange'
                            });
                        }
                    }
                })
            }, __("Create"));
        }
    }
})

frappe.ui.form.on("Material Request Item", {
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        row.custom_plant = frm.doc.custom_plant
    }
})