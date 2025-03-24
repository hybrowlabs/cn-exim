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
        // frm.add_custom_button("GRN", function () {
        //     let purchase_item_list = [];
        //     let requests = [];

        //     $.each(frm.doc.gate_entry_details || [], function (i, d) {
        //         let request = new Promise((resolve, reject) => {
        //             frappe.call({
        //                 method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_po_item_name",
        //                 args: {
        //                     po_name: d.purchase_order,
        //                     item_code: d.item
        //                 },
        //                 callback: function (response) {
        //                     if (response.message && response.message.length > 0 && response.message[0]['name']) {
        //                         purchase_item_list.push({
        //                             "item_code": d.item,
        //                             "item_name": d.item_name,
        //                             "uom": d.uom,
        //                             "rate": d.rate,
        //                             "amount": d.amount,
        //                             "base_rate": d.rate_inr,
        //                             "base_amount": d.amount_inr,
        //                             "qty":d.qty,
        //                             "purchase_order_item": response.message[0]['name']
        //                         });
        //                         resolve();
        //                     } else {
        //                         frappe.msgprint(`Purchase Order Item not found for ${d.item}`);
        //                         reject(`No PO Item found for ${d.item}`);
        //                     }
        //                 }
        //             });
        //         });

        //         requests.push(request);
        //     });

        //     // Wait for all API calls to finish before inserting Purchase Receipt
        //     Promise.all(requests)
        //         .then(() => {
        //             if (purchase_item_list.length === 0) {
        //                 frappe.msgprint("No valid items found to create Purchase Receipt.");
        //                 return;
        //             }

        //             frappe.call({
        //                 method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_update_po_details",
        //                 args: {
        //                     e_waybill: frm.doc.e_waybill_no || ""
        //                 },
        //                 callback: function (response) {
        //                     let data = response.message?.[0] || {};
        //                     let purchase_receipt_data = {
        //                         "doctype": "Purchase Receipt",
        //                         "supplier": frm.doc.supplier,
        //                         "supplier_name": frm.doc.supplier_name,
        //                         "custom_gate_entry_no": frm.doc.name,
        //                         "items": purchase_item_list,
        //                         "custom_bcd_amount": data['bcd_amount'] || 0,
        //                         "custom_pickup_request": data['pickup_request'] || "",
        //                         "custom_freight_amount": data['freight_amount'] || 0,
        //                         "custom_hcs_amount": data['hcs_amount'] || 0,
        //                         "custom_exworks": data['ex_works'] || 0,
        //                         "custom_other_charges": data['other_charges'] || 0,
        //                         "custom_rfq_no": data['rfq_no'] || "",
        //                         "custom_sws_amount": data['sws_amount'] || 0,
        //                         "custom_insurance_amount": data['insurance_amount'] || 0,
        //                         "custom_master_number": data['master_number'] || "",
        //                         "custom_igst_amount": data['igst_amount'] || 0,
        //                         "custom_total_duty": data['total_duty'] || 0,
        //                         "custom_insurance_": data['insurance_'] || 0,
        //                         "CHA Agenncy Charges": data['cha_agenncy_charges'] || 0,
        //                         "custom_cha_clearing_charges": data['cha_clearing_charges'] || 0,
        //                         "custom_local_transporter_charges": data['local_transporter_charges'] || 0,
        //                         "custom_local_freight_vendor_charges": data['local_freight_vendor_charges'] || 0,
        //                         "custom_freight_and_forwarding_vendor_charges": data['freight_and_forwarding_vendor_charges'] || 0,
        //                         "custom_update_po_number": data['name'] || "",
        //                         "custom_total_category_charges": data['total_category_charges'] || 0,
        //                         "custom_house_number": data['house_number'] || ""
        //                     };

        //                     // Add e_waybill-specific field only if e_waybill_no exists
        //                     if (frm.doc.e_waybill_no) {
        //                         purchase_receipt_data["custom_pre_alert_request"] = data['pre_alert_check_list'] || "";
        //                     }

        //                     frappe.call({
        //                         method: "frappe.client.insert",
        //                         args: {
        //                             doc: purchase_receipt_data
        //                         },
        //                         callback: function (r) {
        //                             if (!r.exc) {
        //                                 frappe.set_route("Form", "Purchase Receipt", r.message.name);
        //                             }
        //                         }
        //                     });
        //                 }
        //             });
        //         })
        //         .catch(error => {
        //             console.error("Error processing PO items:", error);
        //         });


        // }, __("Create"));



        frm.add_custom_button("GRN", function () {
            let purchase_item_list = [];
            let purchase_tax_list = [];
            let purchase_extra_charges_list = [];
            let requests = [];
            let purchase_order_numbers = new Set();  // Use a Set to store unique PO numbers

            // Collect unique Purchase Order Numbers and process items
            $.each(frm.doc.gate_entry_details || [], function (i, d) {
                purchase_order_numbers.add(d.purchase_order);  // Store unique POs
                console.log("purchase_order_numbers",purchase_order_numbers)

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
                                    "qty": d.qty,
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

            console.log("Unique PO Numbers:", [...purchase_order_numbers]);

            // First, wait for item data to be collected
            Promise.all(requests).then(() => {
                let taxRequests = [];

                // Fetch tax and charges data for each unique PO
                [...purchase_order_numbers].forEach(po => {
                    let taxRequest = new Promise((resolve, reject) => {
                        frappe.call({
                            method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_tax_and_charges",
                            args: { po_name: po },
                            callback: function (response) {
                                console.log("response", response)
                                if (response.message) {
                                    let tax_table = response.message.tax_table || [];
                                    let extra_charges = response.message.extra_charge || [];

                                    tax_table.forEach(tax => {
                                        purchase_tax_list.push({
                                            "charge_type": tax.charge_type,
                                            "account_head": tax.account_head,
                                            "rate": tax.rate,
                                            "amount": tax.tax_amount,
                                            "total": tax.total,
                                            "description": tax.description,
                                            "base_amount": tax.base_amount,
                                            "segment": tax.segment,
                                            "plant": tax.plant,
                                            "account_currency": tax.account_currency,
                                            "tax_amount": tax.tax_amount,
                                            "tax_amount_after_discount_amount": tax.tax_amount_after_discount_amount,
                                            "base_tax_amount": tax.base_tax_amount,
                                            "base_tax_amount_after_discount_amount": tax.base_tax_amount_after_discount_amount,
                                        });
                                    });

                                    extra_charges.forEach(charge => {
                                        purchase_extra_charges_list.push({
                                            "supplier": charge.supplier,
                                            "account_head": charge.account_head,
                                            "reference_item_code": charge.reference_item_code,
                                            "amount": charge.amount,
                                            "item_code": charge.item_code,
                                            "description": charge.description
                                        });
                                    });

                                    resolve();
                                } else {
                                    reject(`No tax and charges found for PO: ${po}`);
                                }
                            }
                        });
                    });

                    taxRequests.push(taxRequest);
                });

                return Promise.all(taxRequests);
            }).then(() => {
                if (purchase_item_list.length === 0) {
                    frappe.msgprint("No valid items found to create Purchase Receipt.");
                    return;
                }

                frappe.call({
                    method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_update_po_details",
                    args: {
                        e_waybill: frm.doc.e_waybill_no || ""
                    },
                    callback: function (response) {
                        let data = response.message?.[0] || {};
                        let purchase_receipt_data = {
                            "doctype": "Purchase Receipt",
                            "supplier": frm.doc.supplier,
                            "supplier_name": frm.doc.supplier_name,
                            "custom_gate_entry_no": frm.doc.name,
                            "items": purchase_item_list,
                            "taxes": purchase_tax_list,
                            "custom_purchase_extra_charge": purchase_extra_charges_list,
                            "custom_bcd_amount": data['bcd_amount'] || 0,
                            "custom_pickup_request": data['pickup_request'] || "",
                            "custom_freight_amount": data['freight_amount'] || 0,
                            "custom_hcs_amount": data['hcs_amount'] || 0,
                            "custom_exworks": data['ex_works'] || 0,
                            "custom_other_charges": data['other_charges'] || 0,
                            "custom_rfq_no": data['rfq_no'] || "",
                            "custom_sws_amount": data['sws_amount'] || 0,
                            "custom_insurance_amount": data['insurance_amount'] || 0,
                            "custom_master_number": data['master_number'] || "",
                            "custom_igst_amount": data['igst_amount'] || 0,
                            "custom_total_duty": data['total_duty'] || 0,
                            "custom_insurance_": data['insurance_'] || 0,
                            "CHA Agenncy Charges": data['cha_agenncy_charges'] || 0,
                            "custom_cha_clearing_charges": data['cha_clearing_charges'] || 0,
                            "custom_local_transporter_charges": data['local_transporter_charges'] || 0,
                            "custom_local_freight_vendor_charges": data['local_freight_vendor_charges'] || 0,
                            "custom_freight_and_forwarding_vendor_charges": data['freight_and_forwarding_vendor_charges'] || 0,
                            "custom_update_po_number": data['name'] || "",
                            "custom_total_category_charges": data['total_category_charges'] || 0,
                            "custom_house_number": data['house_number'] || ""
                        };

                        if (frm.doc.e_waybill_no) {
                            purchase_receipt_data["custom_pre_alert_request"] = data['pre_alert_check_list'] || "";
                        }

                        frappe.call({
                            method: "frappe.client.insert",
                            args: { doc: purchase_receipt_data },
                            callback: function (r) {
                                if (!r.exc) {
                                    frappe.set_route("Form", "Purchase Receipt", r.message.name);
                                }
                            }
                        });
                    }
                });
            }).catch(error => {
                console.error("Error processing PO items or tax details:", error);
            });

        }, __("Create"));

    },

    on_submit: function (frm) {
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
                        method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.create_stock_entry_for_stock_received",
                        args: {
                            doc: frm.doc,
                            warehouse: r.message.custom_default_temporary_warehouse
                        },
                        callback: function (response) {
                            // if (!response.exc) {
                            //     frappe.msgprint("Stock Entry Created Successfully!");
                            // } else {
                            //     frappe.msgprint("Error creating Stock Entry!");
                            // }
                        }
                    });
                } else {
                    frappe.msgprint("Temporary Warehouse not found for this Company!");
                }
            }
        });
    },
});
