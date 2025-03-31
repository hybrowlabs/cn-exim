frappe.ui.form.on("Purchase Order", {
    refresh: function (frm) {
        if (frm.doc.custom_purchase_sub_type == "Import" && frm.doc.docstatus == 1) {
            frm.add_custom_button("Pickup Request", function () {
                let purchase_order_list = [{
                    po_number: frm.doc.name,
                    currency: frm.doc.currency,
                }];

                let po_item_details = []

                frm.doc.items.forEach(element => {
                    po_item_details.push({
                        'item': element.item_code,
                        'material': element.item_name,
                        'quantity': element.qty,
                        'material_desc': element.description,
                        'pick_qty': element.qty,
                        'po_number': element.parent,
                        'currency': frm.doc.currency,
                        'currency_rate': frm.doc.conversion_rate,
                        'rate': element.rate,
                        'amount': element.amount,
                        'amount_in_inr': element.base_amount,
                    })
                });

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            "doctype": "Pickup Request",
                            "name_of_supplier": frm.doc.supplier,
                            "supplier_address": frm.doc.supplier_address,
                            "purchase_order_list": purchase_order_list,
                            "purchase_order_details": po_item_details,
                            "remarks": "test",
                            "total_amount": frm.doc.total,
                        }
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route("Form", "Pickup Request", r.message.name)
                        }
                    }
                });

            }, __("Create"))
        }
        frappe.call({
            method: "cn_exim.config.py.purchase_order.get_stage_status",
            args: { purchase_order_name: frm.doc.name },
            callback: function (r) {
                if (r.message) {
                    update_progress_bar(frm, r.message);
                }
            }
        });

        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Gate Entry", function () {

                let get_entry_details = []

                frm.doc.items.forEach(element => {
                    get_entry_details.push({
                        "purchase_order": frm.doc.name,
                        "item": element.item_code,
                        "item_name": element.item_name,
                        "uom": element.uom,
                        "rate": element.rate,
                        "amount": element.base_rate,
                        "qty": element.qty,
                        "rate_inr": element.amount,
                        "amount_inr": element.base_amount
                    })
                })
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            "doctype": "Gate Entry",
                            "supplier": frm.doc.supplier,
                            "supplier_name": frm.doc.supplier_name,
                            "gate_entry_details": get_entry_details
                        }
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route("Form", "Gate Entry", r.message.name)
                        }
                    }
                })
            }, __("Create"))
        }
        setTimeout(() => {
            frm.remove_custom_button('Update Items');
        }, 10)
        frm.set_query("account_head", "custom_purchase_extra_charge", function () {
            return {
                filters: {
                    company: frm.doc.company
                }
            }
        })

        if(frm.doc.custom_purchase_extra_charge && frm.doc.custom_purchase_extra_charge.length !== 0 && frm.doc.docstatus === 1){
            frm.add_custom_button("Extra Purchase Invoice", function () {
                let supplier_grouped_items={}
                frm.doc.custom_purchase_extra_charge.forEach(item=>{
                    if ( !supplier_grouped_items[item.supplier]){
                        supplier_grouped_items[item.supplier]=[]
                    }
                    supplier_grouped_items[item.supplier].push({
                        // "purchase_order":frm.doc.name,
                        "item_code":item.item_code,
                        "rate":item.amount,
                        "amount":item.amount,
                        "qty":1,
                        "expense_account":item.account_head
                    })
                })
                Object.keys(supplier_grouped_items).forEach(supplier=>{
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                "doctype": "Purchase Invoice",
                                "supplier": supplier,
                                "items":supplier_grouped_items[supplier],
                                "custom_purchase_order":frm.doc.name
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.set_route("Form", "Purchase Invoice", r.message.name)
                            }
                        }
                    });
                })
            }, __("Create"))
        }
    },
    supplier: function (frm) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Supplier",
                filters: {
                    name: frm.doc.supplier
                },
                fieldname: "supplier_group"
            },
            callback: function (response) {
                console.log("response", response.message["supplier_group"])

                if (response.message['supplier_group'] == "Domestic Material") {
                    let type = response.message['supplier_group']
                    // setInterval(function () {
                        // set_filter_item_supplier_group_wise(type, frm)
                    // }, 500);
                }
            }
        })
    },
    // before_save: function (frm) {
    //     frm.doc.items.forEach(row => {
    //         update_charges_tax_table(frm, row)
    //     })
    //     set_print_format_base_on_field_value(frm)
    // },
    onload: function (frm) {
        let type = ""
        // set_filter_item_supplier_group_wise(type, frm)
        //     if (frm.doc.items && Array.isArray(frm.doc.items)) { 
        //         frm.doc.items.forEach(item => {
        //             console.log(item.item_code)
        //             if (!item.custom_item_charges_templte && item.item_code != undefined) {
        //                 frappe.call({
        //                     method: "frappe.client.get_value",
        //                     args: {
        //                         doctype: "Item",
        //                         filters: {
        //                             name: item.item_code
        //                         },
        //                         fieldname: "custom_item_charge"
        //                     },
        //                     callback: function (response) {
        //                         if (response && response.message) {
        //                             let data = response.message;
        //                             item.custom_item_charges_templte = data.custom_item_charge;
        //                             frm.refresh_field("items");
        //                         }
        //                     }
        //                 });
        //             }
        //         });
        //     } else {
        //         console.warn("No items found in frm.doc.items");
        //     }

    }
})


frappe.ui.form.on('Purchase Order Item', {
    custom_create_delivery_schedule: function (frm, cdt, cdn) {
        var data = locals[cdt][cdn];

        // Fetch existing schedule details for the selected item where received_qty == 0
        let existing_schedule = frm.doc.custom_delivery_schedule_details.filter(element =>
            element.parent == frm.doc.name && element.item_code == data.item_code && element.received_qty == 0
        );

        let d = new frappe.ui.Dialog({
            title: 'Create Delivery Schedule',
            fields: [
                {
                    label: 'Delivery Schedule',
                    fieldname: 'delivery_schedule',
                    fieldtype: 'Table',
                    fields: [
                        {
                            label: 'Schedule Date',
                            fieldname: 'date',
                            fieldtype: 'Date',
                            in_list_view: 1,
                            reqd: 1,
                        },
                        {
                            label: 'Quantity',
                            fieldname: 'qty',
                            fieldtype: 'Float',
                            in_list_view: 1,
                            reqd: 1,
                        }
                    ],
                    data: existing_schedule.map(row => ({
                        date: row.schedule_date,
                        qty: row.qty
                    })),
                    get_data: () => {
                        return d.get_values().delivery_schedule || [];
                    }
                }
            ],
            primary_action_label: 'Submit',
            primary_action(values) {
                let total_qty = 0;

                // Calculate total quantity entered in the dialog
                values.delivery_schedule.forEach(row => {
                    total_qty += row.qty;
                });

                if (total_qty > data.qty) {
                    frappe.msgprint(`The total quantity (${total_qty}) exceeds the entered quantity (${data.qty}).`);
                } else {
                    d.hide();

                    // Remove old rows that do not match the new schedule
                    frm.doc.custom_delivery_schedule_details = frm.doc.custom_delivery_schedule_details.filter(element =>
                        !(element.item_code == data.item_code && !values.delivery_schedule.some(row => row.date === element.schedule_date))
                    );

                    // Update existing rows or create new ones
                    values.delivery_schedule.forEach(row => {
                        let existing_row = frm.doc.custom_delivery_schedule_details.find(element =>
                            element.item_code == data.item_code && element.schedule_date == row.date
                        );

                        if (existing_row) {
                            // Update the quantity if date matches
                            existing_row.qty = row.qty;
                        } else {
                            // Add a new row if the date is changed
                            let add_child = frm.add_child("custom_delivery_schedule_details");
                            add_child.item_code = data.item_code;
                            add_child.schedule_date = row.date;
                            add_child.qty = row.qty;
                            add_child.material_request = data.material_request;
                        }
                    });

                    // Refresh the child table to reflect changes
                    frm.refresh_field("custom_delivery_schedule_details");

                    frappe.msgprint('Delivery schedule updated successfully.');
                }
            }
        });

        // Show dialog
        d.show();
    },
    // item_code: function (frm, cdt, cdn) {
    //     let row = locals[cdt][cdn]
    //     update_charges_tax_table(frm, row)
    // },
    custom_item_charges_templte: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        set_extra_charges_in_table(frm, row)
    }
});



function update_progress_bar(frm, stage_status) {
    let stages = [
        { field: 'pickup_request', label: 'Pickup Request', status: stage_status.pickup_request },
        { field: 'rfq', label: 'RFQ', status: stage_status.rfq },
        { field: 'supplier_quotation', label: 'Supplier Quotation', status: stage_status.supplier_quotation },
        { field: 'pre_alert', label: 'Pre-Alert', status: stage_status.pre_alert },
        { field: 'pre_alert_checklist', label: 'Pre-Alert Checklist', status: stage_status.pre_alert_checklist },
        { field: 'bill_of_entry', label: 'Bill of Entry', status: stage_status.bill_of_entry },
        { field: 'eway_bill', label: 'E-Way Bill', status: stage_status.eway_bill },
        { field: 'po_update', label: 'PO Update', status: stage_status.po_update },
        { field: 'purchase_receipt', label: 'Purchase Receipt', status: stage_status.purchase_receipt },
        { field: 'purchase_invoice', label: 'Purchase Invoice', status: stage_status.purchase_invoice }
    ];

    let completed = stages.filter(stage => stage.status);
    let progress = Math.round((completed.length / stages.length) * 100);

    let progress_html = `
        <div style="width: 100%; background-color: #f0f0f0; border-radius: 5px; overflow: hidden;">
            <div style="width: ${progress}%; background-color: #4caf50; height: 20px; text-align: center; color: white; line-height: 20px;">
                ${progress}%
            </div>
        </div>
    `;

    frm.fields_dict.custom_progress_bar.$wrapper.html(progress_html);
}


// function update_charges_tax_table(frm, row) {
//     if (row.custom_item_charges_templte != undefined) {
//         frappe.call({
//             method: "cn_exim.config.py.purchase_order.get_item_wise_charges",
//             args: {
//                 name: row.custom_item_charges_templte
//             },
//             callback: function (response) {
//                 let data = response.message

//                 data.forEach(element => {
//                     let exists = frm.doc.taxes.some(tax =>
//                         tax.charge_type === element.type &&
//                         tax.account_head === element.account_head &&
//                         tax.custom_item_code === row.item_code
//                     );
//                     if (!exists) {
//                         let new_row = frm.add_child("taxes")
//                         new_row.charge_type = element.type;
//                         new_row.account_head = element.account_head;
//                         new_row.tax_amount = element.amount;
//                         new_row.custom_item_code = row.item_code;
//                         new_row.description = element.description;
//                     }
//                 })
//                 frm.refresh_field("taxes")
//             }
//         })
//     }
// }




function set_print_format_base_on_field_value(frm) {
    if (frm.doc.custom_purchase_sub_type == "Import" && frm.doc.docstatus == 0) {
        frm.set_value("custom_print_format", "Import Po Before Release")
    }
    else if (frm.doc.custom_purchase_sub_type == "Import" && frm.doc.docstatus == 1) {
        frm.set_value("custom_print_format", "Import Po After Release")
    }
    else if (frm.doc.custom_purchase_sub_type == "Domestic") {
        frm.set_value("custom_print_format", "Domestic Po After Release")
    }
}

function set_extra_charges_in_table(frm, row) {
    frappe.call({
        method: "cn_exim.config.py.purchase_order.get_extra_charge_template",
        args: {
            name: row.custom_item_charges_templte
        },
        callback: function (response) {
            let data = response.message

            let total_charge = 0
            data.forEach(obj => {
                let new_row = frm.add_child("custom_purchase_extra_charge")
                new_row.amount = obj.amount;
                new_row.account_head = obj.account_head;
                new_row.description = obj.description;
                new_row.reference_item_code = row.item_code;
                new_row.item_code = obj.item_code;
                total_charge += obj.amount;
            })
            frm.set_value("custom_total_charges", total_charge)
            frm.refresh_field("custom_purchase_extra_charge")
        }
    })
}


function set_filter_item_supplier_group_wise(type, frm) {
    if (frm.doc.type == "Domestic Material") {
        frm.fields_dict['items'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    is_stock_item: 1
                }
            };
        };
    } else if (frm.doc.type == "Domestic Service") {
        console.log("Type selected:", frm.doc.type);
        frm.fields_dict['items'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
            return {
                filters: {
                    is_stock_item: 0
                }
            };
        };
    }
}
