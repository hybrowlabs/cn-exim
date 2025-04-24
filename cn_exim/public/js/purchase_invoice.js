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
    },
    onload: function (frm) {
        if (frm.doc.docstatus == 0) {
            let has_purchase_order = (frm.doc.items || []).some(d => d.purchase_order && d.purchase_order.trim() !== '');

            console.log(has_purchase_order)
            if (has_purchase_order) {
                $.each(frm.doc.items || [], function (i, d) {
                    if (frm.doc.payment_terms_template == undefined && d.purchase_order != undefined) {
                        frappe.call({
                            method: "cn_exim.config.py.purchase_invoice.get_payment_trams",
                            args: {
                                name: d.purchase_order
                            },
                            callback: function (response) {

                                let data = response.message[0]
                                if (data.payment_terms_template) {
                                    console.log("this call")
                                    frm.set_value("payment_terms_template", data['payment_terms_template'])
                                }

                            }
                        })
                    }
                })
            }
        }
    },

    refresh: frm => {
        if (frm.doc.items && frm.doc.docstatus == 0) {
            if (frm.doc.items[0].purchase_receipt) {
                frappe.call({
                    method: 'cn_exim.config.py.purchase_invoice.get_due_date_based_on_condition',
                    args: { pr: frm.doc.items[0].purchase_receipt },
                    freeze: true,
                    callback: r => {
                        if (r.message.due_date) {
                            frm.set_df_property('cnp_section_break_wob2z', 'hidden', true);
                        }
                        else if (r.message.status) {
                            frm.set_df_property('cnp_section_break_wob2z', 'hidden', false);
                        }
                    }
                })
            }
        }
        // console.log("Form is refreshed, docstatus:", frm.doc.docstatus);
            if(frm.doc.docstatus===1){
                frm.add_custom_button("Landed Cost Voucher",function (){
                    
                    // frappe.msgprint("Clicked on Landed Cost Voucher button")
                    // console.log(frm.doc);
                    
                    // console.log(frm.doc.custom_purchase_order);
                    
                    frappe.call({
                        method:"cn_exim.config.py.purchase_invoice.get_landed_cost_voucher_details",
                        args:{
                            purchase_invoice_name:frm.doc.name,
                            // purchase_invoice_items:frm.doc.items,
                            custom_purchase_order:frm.doc.custom_purchase_order
                        },
                        callback: function(r){
                            if (r.exc) {
                                frappe.throw("Error: " + r.exc);
                                return;
                            }
                            let purchase_receipts=r.message[0]
                            let taxes_data = r.message[1] || [];
                            let purchase_invoice_details=r.message[2] || []
                            // purchase_receipts.forEach(element => {
                                
                            // });

                            let seen_receipts = new Set();
                            let purchase_receipt_rows = [];

                            if (Array.isArray(purchase_receipts)) {
                                purchase_receipts.forEach(receipt => {
                                    if (!seen_receipts.has(receipt.name)) {
                                        seen_receipts.add(receipt.name);
                                        purchase_receipt_rows.push({
                                            receipt_document_type: 'Purchase Receipt',
                                            receipt_document: receipt.name,
                                            supplier: receipt.supplier,
                                            grand_total: receipt.grand_total
                                        });
                                    }
                                });
                            }

                            console.log(purchase_receipt_rows)
                            // If it's a single object
                            // else if (typeof purchase_receipts === 'object') {
                            //     purchase_receipt_rows = [{
                            //         receipt_document_type: 'Purchase Receipt',
                            //         receipt_document: purchase_receipts.name,
                            //         supplier: purchase_receipts.supplier,
                            //         grand_total: purchase_receipts.grand_total
                            //     }];
                            // }

                            let taxes_rows = [];
                            if (Array.isArray(taxes_data)) {
                                taxes_rows = taxes_data.map(tax => {
                                    return {
                                        expense_account: tax.account_head,
                                        description: tax.description,
                                        amount: tax.amount
                                    };
                                });
                            }
                            // Store purchase invoice details for context (will be used for custom fields if needed)
                            let pi_details_rows = [];
                            if (Array.isArray(purchase_invoice_details) && purchase_invoice_details.length > 0) {
                                pi_details_rows=purchase_invoice_details.map( pi=>{
                                    return{
                                    purchase_invoice:pi.purchase_invoice,
                                    expense_account:pi.expense_account,
                                    amount:pi.amount,
                                    supplier:pi.supplier,
                                    date:pi.date,
                                    item:pi.item,
                                    }
                                })
                            }

                            if (purchase_receipt_rows.length > 0) {
                                frappe.call({
                                    method: "frappe.client.insert",
                                    args:{
                                        doc: {
                                            'doctype': "Landed Cost Voucher",
                                            'distribute_charges_based_on': "Amount",
                                            'purchase_receipts': purchase_receipt_rows,
                                            'taxes': taxes_rows,
                                            'custom_purchase_invoice_details':pi_details_rows
                                        }
                                    },
                                    callback: function (r) {
                                        // console.log(purchase_receipts);
                                        
                                        if (!r.exc) {
                                            frappe.set_route("Form", "Landed Cost Voucher", r.message.name);
                                        }
                                    }
                                })
                            } else {
                                frappe.msgprint("No Purchase Receipts found for this Purchase Order.");
                            }
                        }
                    });
                },__("Create"))
            }


    },
    before_save: frm => {
        let is_block = false
        $.each(frm.doc.payment_schedule || [], function (i, d) {
            if (d.custom_purchase_invoice_blocked) {
                is_block = true
            }
        })

        if (is_block) {
            frm.set_value("on_hold", 1)
        }
        if (frm.doc.items) {
            if (frm.doc.items[0].purchase_receipt) {
                frappe.call({
                    method: 'cn_exim.config.py.purchase_invoice.get_due_date_based_on_condition',
                    args: { pr: frm.doc.items[0].purchase_receipt },
                    freeze: true,
                    callback: r => {
                        if (r.message.due_date) {
                            frm.doc.payment_schedule[0].due_date = r.message.due_date;
                            frm.doc.due_date = r.message.due_date;
                        }
                        else if (r.message.status) {
                            let installation_date = frm.doc.cnp_installation_date
                            let expected_installation_date = frm.doc.cnp_expected_installation_date
                            if (frm.doc.cnp_is_installed && installation_date) {
                                frm.doc.payment_schedule[0].due_date = installation_date;
                                frm.doc.due_date = installation_date;
                            }
                            else if (!frm.doc.cnp_is_installed && expected_installation_date) {
                                frm.doc.payment_schedule[0].due_date = expected_installation_date;
                                frm.doc.due_date = expected_installation_date;
                            }
                        }
                    }
                })
            }
        }
    },
    cnp_expected_installation_date: frm => {
        update_due_date(frm)
    },
    cnp_installation_date: frm => {
        update_due_date(frm)
    },
    on_update: frm => {
    },
});

function update_due_date(frm) {
    let installation_date = frm.doc.cnp_installation_date
    let expected_installation_date = frm.doc.cnp_expected_installation_date
    if (frm.doc.cnp_is_installed && installation_date) {
        frm.doc.payment_schedule[0].due_date = installation_date;
        frm.doc.due_date = installation_date;
    }
    else if (!frm.doc.cnp_is_installed && expected_installation_date) {
        frm.doc.payment_schedule[0].due_date = expected_installation_date;
        frm.doc.due_date = expected_installation_date;
    }
}
