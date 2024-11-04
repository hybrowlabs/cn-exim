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
    }
})