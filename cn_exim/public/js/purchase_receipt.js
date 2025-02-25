frappe.ui.form.on("Purchase Receipt", {
    refresh: function (frm) {
        frm.add_custom_button("Landed Cost Voucher", function () {
            let purchase_receipts = []
            let taxes_list = []

            purchase_receipts.push({
                'receipt_document_type': 'Purchase Receipt',
                'receipt_document': frm.doc.name,
                'supplier': frm.doc.supplier,
                'grand_total': frm.doc.base_grand_total,
            })

            let d = new frappe.ui.Dialog({
                title: "Enter Details",
                fields: [
                    {
                        label: "Amount",
                        fieldname: "amount",
                        fieldtype: "Data"
                    },
                    {
                        label: "Description",
                        fieldname: "description",
                        fieldtype: "Data"
                    }
                ],
                size: "small",
                primary_action_label: 'Submit',
                primary_action(value) {
                    taxes_list.push({
                        'amount': value['amount'],
                        'description': value['description'],
                    })

                    d.hide();
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                'doctype': "Landed Cost Voucher",
                                'distribute_charges_based_on': "Amount",
                                'purchase_receipts': purchase_receipts,
                                'taxes': taxes_list,
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.show_alert({
                                    message: __('Landed Code Voucher created successfully!'),
                                    indicator: 'green'
                                }, 5);
                            } else {
                                frappe.msgprint('There was an error saving the Purchase Receipt');
                                console.error('Error Saving Document:', r.exc);
                            }
                        }
                    })
                }
            })
            d.show();

        }, ("Create"))
    },
    custom_scan_barcodes: function (frm) {
        frappe.call({
            method: "cn_exim.config.py.purchase_receipt.get_po_details_to_gate_entry",
            args: {
                gate_entry_name: frm.doc.custom_scan_barcodes
            },
            callback: function (r) {
                let gate_entry = r.message[0]
                let gate_entry_details = r.message[1]

                frm.set_value("supplier", gate_entry[0]['supplier'])
                frm.set_value("supplier_name", gate_entry[0]['supplier_name'])

                let len = frm.doc.items.length
                let item_check = false
                $.each(frm.doc.items || [], function (i, d) {
                    if (d.item_code == undefined) {
                        item_check = true
                    }
                })

                if(len == 1 && item_check == true){
                    frm.set_value("items", 0)
                }

                gate_entry_details.forEach(element => {
                    let row = frm.add_child("items")
                    row.item_code = element.item;
                    row.item_name = element.item_name;
                    row.qty = element.qty;
                    row.rate = element.rate;
                    row.base_rate = element.rate_inr;
                    row.amount = element.amount;
                    row.base_amount = element.base_amount;
                });
                frm.refresh_field("items")
                frm.set_value("custom_scan_barcodes", "")
            }
        })
    }
})