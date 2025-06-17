frappe.ui.form.on("Purchase Receipt", {
    refresh: function (frm) {
        frm.remove_custom_button("Landed Cost Voucher", "Create")
        frm.add_custom_button("Landed Cost Vouchers", function () {
            let purchase_receipts = []
            let taxes_list = []

            purchase_receipts.push({
                'receipt_document_type': 'Purchase Receipt',
                'receipt_document': frm.doc.name,
                'supplier': frm.doc.supplier,
                'grand_total': frm.doc.base_grand_total,
            })

            frm.doc.custom_purchase_extra_charge.forEach(item =>{
                taxes_list.push({
                    "expense_account":item.account_head,
                    "description":item.description,
                    "amount":item.amount,
                })
            })

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
                        frappe.set_route("Form", "Landed Cost Voucher", r.message.name);
                    } else {
                        frappe.msgprint('There was an error saving the Purchase Receipt');
                        console.error('Error Saving Document:', r.exc);
                    }
                }
            })

            // let d = new frappe.ui.Dialog({
            //     title: "Enter Details",
            //     fields: [
            //         {
            //             label: "Amount",
            //             fieldname: "amount",
            //             fieldtype: "Data"
            //         },
            //         {
            //             label: "Description",
            //             fieldname: "description",
            //             fieldtype: "Data"
            //         }
            //     ],
            //     size: "small",
            //     primary_action_label: 'Submit',
            //     primary_action(value) {
            //         taxes_list.push({
            //             'amount': value['amount'],
            //             'description': value['description'],
            //         })

            //         d.hide();
            //         frappe.call({
            //             method: "frappe.client.insert",
            //             args: {
            //                 doc: {
            //                     'doctype': "Landed Cost Voucher",
            //                     'distribute_charges_based_on': "Amount",
            //                     'purchase_receipts': purchase_receipts,
            //                     'taxes': taxes_list,
            //                 }
            //             },
            //             callback: function (r) {
            //                 if (!r.exc) {
            //                     frappe.show_alert({
            //                         message: __('Landed Code Voucher created successfully!'),
            //                         indicator: 'green'
            //                     }, 5);
            //                 } else {
            //                     frappe.msgprint('There was an error saving the Purchase Receipt');
            //                     console.error('Error Saving Document:', r.exc);
            //                 }
            //             }
            //         })
            //     }
            // })
            // d.show();

        }, ("Create"))

    },
    custom_scan_barcodes: async function (frm) {
        if (!frm.doc.custom_scan_barcodes) return; 
        let custom_scan_barcode=frm.doc.custom_scan_barcodes
        frappe.call({
            method: "cn_exim.config.py.purchase_receipt.get_po_details_to_gate_entry",
            
            args: {
                gate_entry_name: frm.doc.custom_scan_barcodes
            },
            callback: function (r) {
                if(!r.message) return;

                let gate_entry = r.message[0]
                let gate_entry_details = r.message[1]
                let gate_entry_extra_purchase_items=r.message[2]
                let get_purchase_order_details=r.message[3]
                
                if (!gate_entry.length || !gate_entry[0]['supplier']) {
                    frappe.msgprint(__("No supplier details found in the response."));
                    return;
                }

                frm.set_value("supplier", gate_entry[0]['supplier'])
                frm.set_value("supplier_name", gate_entry[0]['supplier_name'])

                frm.set_value("custom_gate_entry_no",custom_scan_barcode)
                
                let len = frm.doc.items.length
                let item_check = false
                $.each(frm.doc.items || [], function (i, d) {
                    if (d.item_code == undefined) {
                        item_check = true
                    }
                })
                
                if (len == 1 && item_check == true) {
                    frm.set_value("items", 0)
                }
                gate_entry_details.forEach(element => {
                    if (!element.item) return; 
                    let purchase_order_item_name = ""
                    frappe.call({
                        method:"cn_exim.config.py.purchase_receipt.get_purchase_order_item_name",
                        args:{
                            item_code:element.item,
                            purchase_order:element.purchase_order
                        },
                        callback:function(r){

                            
                            let data = r.message[0]
                            // console.log("coming",data);
                            // console.log("coming",data.name);
                            purchase_order_item_name = data.name
                            
                            let row = frm.add_child("items")
                            row.item_code = element.item;
                            row.item_name = element.item_name;
                            row.qty = element.qty;
                            row.rate = element.rate;
                            row.base_rate = element.rate_inr;
                            row.amount = element.amount;
                            row.base_amount = element.base_amount;
                            row.uom=element.uom;
                            row.purchase_order_item = purchase_order_item_name;``
                            frm.refresh_field("items")
                        }
                    })
                });
                
                gate_entry_extra_purchase_items.forEach(element =>{
                    if(!element.supplier || !element.account_head) return;
                    let row =frm.add_child("custom_purchase_extra_charge");
                    row.supplier=element.supplier;
                    row.account_head=element.account_head;
                    row.item_code=element.item_code;
                    row.amount=element.amount || 0;
                    row.reference_item_code=element.reference_item_code;
                    row.description=element.description || "";
                })
                frm.refresh_field("custom_purchase_extra_charge")

                let custom_total_charges=get_purchase_order_details[0]['custom_total_charges']
                if(custom_total_charges){
                    setTimeout(()=>{
                        frm.set_value("custom_total_charges",custom_total_charges)
                        frm.refresh_field("custom_total_charges")
                    },500)
                }

                if (get_purchase_order_details.length > 0 && get_purchase_order_details[0]['taxes_and_charges']) {
                    let tax_template = get_purchase_order_details[0]['taxes_and_charges'];
                    frappe.db.get_value("Purchase Taxes and Charges Template", tax_template, "name").then(r => {
                        if (r.message && r.message.name) {
                            setTimeout(() => {
                                frm.set_value("taxes_and_charges", r.message.name);
                                frm.refresh_field("taxes_and_charges");
                            }, 1000);
                        } else {
                            frappe.throw("Invalid Taxes and Charges Template:", tax_template);
                        }
                    });
                } else {
                    frappe.msgprint("No Taxes and Charges found in Purchase Order");
                }
                frm.set_value("custom_scan_barcodes", "")
            }
        })
    },
    on_submit: function (frm) {
        if (frm.doc.custom_gate_entry_no != undefined) {
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Company",
                    filters: {
                        name: frm.doc.company
                    },
                    fieldname: "custom_default_temporary_warehouse"
                },
                callback: function (r) {
                    frappe.call({
                        method: "cn_exim.config.py.purchase_receipt.create_stock_entry",
                        args: {
                            doc: frm.doc,
                            gate_entry: frm.doc.custom_gate_entry_no,
                            warehouse: r.message.custom_default_temporary_warehouse
                        }
                    })
                }
            })
        }
        frm.doc.items.forEach(element => {
            console.log(element.custom_blanket_order)
            if (element.custom_blanket_order != undefined) {
                frappe.call({
                    method: "cn_exim.config.py.purchase_receipt.update_blanket_order",
                    args: {
                        name: element.custom_blanket_order,
                        item_code: element.item_code,
                        qty: element.qty
                    },
                    callback: function (r) {

                    }
                })
            }
        })
    },

    validate: function (frm) {
        let promises = [];

        frm.doc.items.forEach(d => {
            if (d.purchase_order_item != undefined) {
                console.log("this is comming from -> ",d.purchase_order_item);
                
                let promise = new Promise((resolve, reject) => {
                    frappe.call({
                        method: "cn_exim.config.py.purchase_receipt.validate_tolerance",
                        args: {
                            name: d.purchase_order_item
                        },
                        callback: function (response) {
                            console.log("response", tolerance);
                            let tolerance = response.message[0];
                            let qty = tolerance['qty'] - tolerance['received_qty'];

                            // Set under_tolerance if defined, else keep it 0 (no lower limit)
                            let under_tolerance = tolerance['custom_under_tolerance']
                                ? qty - ((qty * tolerance['custom_under_tolerance']) / 100)
                                : qty;

                            // Set over_tolerance if defined, else keep it as qty (no upper limit)
                            let over_tolerance = tolerance['custom_over_tolerance']
                                ? (qty * tolerance['custom_over_tolerance']) / 100 + qty
                                : qty;

                            // Validation check: Only apply limits if tolerance values are available
                            if ((tolerance['custom_under_tolerance'] > 0 && d.qty < under_tolerance) ||
                                (tolerance['custom_over_tolerance'] > 0 && d.qty > over_tolerance)) {

                                frappe.msgprint({
                                    title: __("Validation Error"),
                                    message: `Quantity <b>${d.qty}</b> for item <b>${d.item_code}</b> is out of tolerance range.<br>
                                            Allowed range: <b>${under_tolerance.toFixed(2)}</b> to <b>${over_tolerance.toFixed(2)}</b>`,
                                    indicator: "red"
                                });
                                reject();
                            } else {
                                resolve();
                            }
                        }

                    });
                });
                promises.push(promise);
            }
        });


        // Wait for all frappe.call() requests to complete before allowing submission
        Promise.allSettled(promises).then(results => {
            let hasError = results.some(result => result.status === "rejected");
            if (hasError) {
                frappe.validated = false;
            }
        });

        // Ensure submission is halted until the validation check is complete
        frappe.validated = false;
        return Promise.all(promises).then(() => {
            frappe.validated = true;
        }).catch(() => {
            frappe.validated = false;
        });
    },
    before_save: function (frm) {
        frm.doc.items.forEach(element => {
            frappe.call({
                method: "cn_exim.config.py.purchase_receipt.get_account",
                args: {
                    item_code: element.item_code,
                    company: frm.doc.company
                },
                callback: function (response) {
                    let data = response.message[0]
                    console.log("this call", data)

                    element.custom_srbnb_account = data.custom_stock_received_but_not_billed
                    // element.expense_account = data.custom_stock_received_but_not_billed
                    frm.refresh_field("items")
                }
            })
        })

        if(frm.is_new() && frm.doc.custom_gate_entry_no){
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Company",
                    filters: {
                        name: frm.doc.company
                    },
                    fieldname: "custom_default_temporary_warehouse"
                },
                callback: function (r) {
                    if (r.message && r.message.custom_default_temporary_warehouse) {
                        frappe.call({
                            method: "cn_exim.config.py.purchase_receipt.create_stock_entry_for_stock_issus",
                            args: {
                                doc: frm.doc,
                                warehouse: r.message.custom_default_temporary_warehouse
                            },
                            callback: function (response) {
                            }
                        });
                    } else {
                        frappe.msgprint("Temporary Warehouse not found for this Company!");
                    }
                }
            });
        }
    },
    onload: function (frm) {
        get_qty(frm)
    },
    validate: function (frm) {
        frm.doc.items.forEach(element => {
            if (element.custom_blanket_order != undefined) {
                frappe.call({
                    method: "cn_exim.config.py.purchase_receipt.validate_qty_for_blanket_order",
                    args: {
                        item_code: element.item_code,
                        name: element.custom_blanket_order
                    },
                    callback: function (response) {
                        let data = response.message[0]

                        let qty = data['qty'] - data['custom_received_qty']

                        if (qty < element.qty) {
                            frappe.validated = false;
                            frappe.msgprint({
                                title: __("Error"),
                                indicator: "red",
                                message: `This Blanket Order <b>${element.custom_blanket_order}</b> is over. Not allowed more quantity! (Remaining Qty: <b>${qty}</b>)`
                            });
                        }
                    }
                })
            }
        })
    }
})

function get_qty(frm) {
    if (frm.is_new()) {
        if (frm.doc.items && frm.doc.items.length > 0) {
            let po_id = new Set(); // Using Set to store unique values
            let transaction_date = frm.doc.posting_date; // Get transaction date

            // Ensure transaction_date is defined
            if (!transaction_date) {
                frappe.msgprint(__('Posting Date is missing.'));
                return;
            }

            // Collect unique purchase order IDs
            $.each(frm.doc.items, function (i, v) {
                if (v.purchase_order) {
                    po_id.add(v.purchase_order);
                }
            });

            po_id = Array.from(po_id); // Convert Set to Array

            $.each(po_id, function (i, purchase_order_id) {
                frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Purchase Order",
                        name: purchase_order_id,
                        docstatus: 1
                    },
                    callback: function (res) {
                        if (res.message && res.message.custom_delivery_schedule_details) {
                            let schedule_details = res.message.custom_delivery_schedule_details;

                            // Iterate over each item in the child table
                            $.each(frm.doc.items, function (idx, item) {
                                // Find the nearest date for the current item's item_code
                                let nearest_schedule = schedule_details
                                    .filter(d => d.received_qty < d.qty && d.schedule_date >= transaction_date && d.item_code == item.item_code) // Match item_code
                                    .sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date))[0];

                                if (nearest_schedule) {
                                    // Set values in the child table
                                    frappe.model.set_value(item.doctype, item.name, "qty", (nearest_schedule.qty - nearest_schedule.received_qty));
                                    frappe.model.set_value(item.doctype, item.name, "custom_row_id", nearest_schedule.name);
                                } else {
                                    console.log(`No valid schedule found for item ${item.item_code}`);
                                }
                            });
                        }
                    }
                });
            });
        }
    }
}
