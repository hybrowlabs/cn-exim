frappe.ui.form.on("Blanket Order", {
    refresh: function (frm) {
        frm.remove_custom_button("Purchase Order", "Create")
        if (frm.doc.blanket_order_type == "Purchasing" && frm.doc.docstatus == 1) {
            frm.add_custom_button("Purchase Receipt", function () {
                let items = [];
                let today = frappe.datetime.get_today();


                frm.doc.items.forEach(element => {
                    let qty = element.qty - element.custom_received_qty;

                    // Ensure quantity is positive
                    if (qty > 0) {
                        items.push({
                            "item_code": element.item_code,
                            "item_name": element.item_name,
                            "qty": qty,
                            "rate": element.rate,
                            "custom_blanket_order": frm.doc.name,
                            "schedule_date":today
                        });
                    }
                });

                if (items.length === 0) {
                    frappe.msgprint(__('No items with positive quantity to create a Purchase Order.'));
                    return;
                }

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            "doctype": "Purchase Receipt",
                            "supplier": frm.doc.supplier,
                            "tc_name": frm.doc.tc_name,
                            "terms": frm.doc.terms,
                            "items": items
                        }
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.set_route("Form", "Purchase Receipt", r.message.name);
                        }
                    }
                });
            }, ("Create"));
        }
    }
})