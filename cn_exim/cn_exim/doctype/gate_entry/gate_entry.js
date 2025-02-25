frappe.ui.form.on("Gate Entry", {
    scan_barcode: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_purchase_order_details",
            args: {
                po_name: frm.doc.scan_barcode
            },
            callback: function (r) {
                let purchase_order = r.message[0]
                let items = r.message[1]

                if (frm.doc.supplier == undefined || frm.doc.supplier == purchase_order[0]['supplier']) {

                    frm.set_value("supplier", purchase_order[0]['supplier'])
                    frm.set_value("supplier_name", purchase_order[0]['supplier_name'])

                    let check_po = false

                    $.each(frm.doc.gate_entry_details || [], function (i, d) {
                        if (d.purchase_order == purchase_order[0]['name']) {
                            check_po = true
                        }
                    })

                    if (check_po == true) {
                        frappe.msgprint("This Purchase Order is already scanned.");
                    }
                    else {
                        items.forEach(obj => {
                            let row = frm.add_child("gate_entry_details")
                            row.purchase_order = purchase_order[0]['name'];
                            row.item = obj.item_code;
                            row.item_name = obj.item_name;
                            row.uom = obj.uom;
                            row.rate = obj.rate;
                            row.qty = obj.qty;
                            row.amount = obj.amount;
                            row.rate_inr = obj.base_rate;
                            row.amount_inr = obj.base_amount;
                        })
                        frm.refresh_field("gate_entry_details")
                    }
                }
                else {
                    frappe.msgprint("Po Supplier IS Different please scan same supplier Po")
                }
                frm.set_value("scan_barcode", "")
            }
        })
    },
    refresh: function (frm) {
        frm.add_custom_button("GRN", function () {
            let purchase_item_list = [];
            let requests = [];

            $.each(frm.doc.gate_entry_details || [], function (i, d) {
                let request = new Promise((resolve, reject) => {
                    frappe.call({
                        method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_po_item_name",
                        args: {
                            po_name: d.purchase_order,
                            item_code: d.item
                        },
                        callback: function (response) {
                            if (response.message && response.message.length > 0 && response.message[0]['name']) {
                                purchase_item_list.push({
                                    "item_code": d.item,
                                    "item_name": d.item_name,
                                    "uom": d.uom,
                                    "rate": d.rate,
                                    "amount": d.amount,
                                    "base_rate": d.rate_inr,
                                    "base_amount": d.amount_inr,
                                    "purchase_order_item": response.message[0]['name']
                                });
                                resolve();
                            } else {
                                frappe.msgprint(`Purchase Order Item not found for ${d.item}`);
                                reject(`No PO Item found for ${d.item}`);
                            }
                        }
                    });
                });

                requests.push(request);
            });

            // Wait for all API calls to finish before inserting Purchase Receipt
            Promise.all(requests)
                .then(() => {
                    if (purchase_item_list.length === 0) {
                        frappe.msgprint("No valid items found to create Purchase Receipt.");
                        return;
                    }

                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                "doctype": "Purchase Receipt",
                                "supplier": frm.doc.supplier,
                                "supplier_name": frm.doc.supplier_name,
                                "items": purchase_item_list
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.set_route("Form", "Purchase Receipt", r.message.name);
                            }
                        }
                    });
                })
                .catch(error => {
                    console.error("Error processing PO items:", error);
                });

        }, __("Create"));

    }
});
