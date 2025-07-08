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
                        let final_qty_map = {};
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

                            if (final_qty_map[purchase_order[0]['name']]) {
                                final_qty_map[purchase_order[0]['name']] += obj.qty;
                            } else {
                                final_qty_map[purchase_order[0]['name']] = obj.qty;
                            }
                        })
                        frm.clear_table("purchase_order_in_gate_entry");

                        // Add summed rows to purchase_order_in_gate_entry
                        for (let po in final_qty_map) {
                            let po_row = frm.add_child("purchase_order_in_gate_entry");
                            po_row.purchase_order = po;
                            po_row.incoming_quantity = final_qty_map[po];
                        }
                        frm.refresh_field("gate_entry_details")
                        frm.refresh_field("purchase_order_in_gate_entry")
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
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("GRN", function () {
                frappe.call({
                    method: "frappe.client.get_value",
                    args: {
                        doctype: "Purchase Receipt",
                        filters: {
                            custom_gate_entry_no: frm.doc.name,
                            docstatus: ["!=", 2]
                        },
                        fieldname: ["name"]
                    },
                    callback: function (r) {
                        if (r.message && r.message['name']) {
                            // A PR already exists
                            frappe.msgprint(`Purchase Receipt <a href="/app/purchase-receipt/${r.message['name']}" target="_blank"><b>${r.message['name']}</b></a> already exists for this Gate Entry.`);
                        } else {
                            let purchase_item_list = [];
                            let purchase_tax_list = [];
                            let purchase_extra_charges_list = [];
                            let requests = [];
                            let purchase_order_numbers = new Set();  // Use a Set to store unique PO numbers

                            // Collect unique Purchase Order Numbers and process items
                            $.each(frm.doc.gate_entry_details || [], function (i, d) {
                                purchase_order_numbers.add(d.purchase_order);  // Store unique POs

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
                                                    "purchase_order_item": response.message[0]['name'],
                                                    "warehouse": response.message[0]['warehouse'] || "",
                                                    "purchase_order": response.message[0]['parent'] || "",
                                                    "project": d.project || "",
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
                                            "custom_supplier_document_no": frm.doc.bill_number,
                                            "custom_supplier_document_date": frm.doc.bill_date,
                                            "items": purchase_item_list,
                                            "taxes": purchase_tax_list,
                                            "currency": frm.doc.currency,
                                            "conversion_rate": frm.doc.currency_rate || 1,
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
                            });
                        }
                    }
                })

            }, __("Create"));
        }


        frm.add_custom_button(__('Get PO Items'), function () {
            if (frm.doc.supplier == undefined || frm.doc.supplier == "") {
                frappe.msgprint("Please select supplier first");
                return;
            }
            else {
                let d = new frappe.ui.form.MultiSelectDialog({
                    doctype: "Purchase Order",
                    target: frm,
                    setters: {
                        supplier: frm.doc.supplier,
                        supplier_name: null
                    },
                    columns: ["name", "transaction_date", "supplier_name"],
                    get_query: function () {
                        return {
                            filters: {
                                docstatus: 1,
                                status: ["not in", ["Closed", "On Hold"]],
                                per_received: ["<", 99.99],
                                company: frm.doc.company,
                            }
                        };
                    },
                    action(selections) {
                        frappe.call({
                            method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_multiple_purchase_order",
                            args: {
                                po_name: JSON.stringify(selections)
                            },
                            callback: function (r) {
                                let po_items_list = r.message['po_items_list']
                                let purchase_order = r.message['po_total_qty']
                                let po_details = r.message['po_details']


                                frm.clear_table("gate_entry_details")

                                po_items_list.forEach(obj => {
                                    let row = frm.add_child("gate_entry_details")
                                    row.purchase_order = obj.purchase_order;
                                    row.item = obj.item;
                                    row.item_name = obj.item_name;
                                    row.uom = obj.uom;
                                    row.rate = obj.rate;
                                    // row.qty = obj.qty;
                                    row.amount = obj.amount;
                                    row.rate_inr = obj.rate_inr;
                                    row.amount_inr = obj.amount_inr;
                                    row.po_qty = obj.qty;
                                    row.po_pending_qty = (obj.qty ?? 0) - ((obj.received_qty ?? 0) + (obj.custom_gate_entry_qty ?? 0))
                                    row.grn_panding_qty = obj.qty - obj.received_qty;
                                })
                                frm.refresh_field("gate_entry_details")

                                frm.clear_table("purchase_order_in_gate_entry");

                                purchase_order.forEach(obj => {
                                    let po_row = frm.add_child("purchase_order_in_gate_entry");
                                    po_row.purchase_order = obj.purchase_order;
                                    po_row.incoming_quantity = obj.incoming_quantity;
                                })
                                frm.refresh_field("purchase_order_in_gate_entry")


                                frm.set_value("supplier", po_details.supplier)
                                frm.set_value("supplier_name", po_details.supplier_name)
                                frm.set_value("currency", po_details.currency)
                                frm.set_value("currency_rate", po_details.conversion_rate)
                                frm.set_value("cost_center", po_details.cost_center)
                            }
                        });

                        d.dialog.hide();
                    }
                });
            }
        }, __('Get Items From'));

        frm.set_query("service_name", function () {
            return {
                filters: {
                    supplier_group: "Service"
                }
            }
        })
    },

    before_save: function (frm) {
        // Prevent infinite loop: skip validation if already validated once
        if (frm._already_validated) {
            frm._already_validated = false;  // Reset for future saves
            return;
        }

        let promises = [];

        frm.doc.gate_entry_details.forEach(function (row) {
            let promise = new Promise((resolve, reject) => {
                frappe.call({
                    method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_row_wise_qty",
                    args: {
                        po_name: row.purchase_order,
                        item_code: row.item,
                    },
                    callback: function (r) {
                        if (!r.message || r.message.length === 0) {
                            reject("No data found for PO and Item.");
                            return;
                        }

                        let server_row = r.message[0];
                        let received_qty = server_row['received_qty'] || 0;
                        let gate_entry_qty = server_row['custom_gate_entry_qty'] || 0;
                        let po_qty = server_row['qty'] || 0;
                        let remaining_qty = po_qty - (received_qty + gate_entry_qty);

                        if (received_qty >= po_qty) {
                            reject("This Purchase Order is already received.");
                            return;
                        }

                        if (gate_entry_qty == 0 && row.qty > po_qty) {
                            reject(`Gate Entry Quantity cannot be greater than Purchase Order for item code '${row.item}'. Your max entry qty: ${remaining_qty}`)
                            return;
                        }
                        if (received_qty == 0) {
                            if (row.qty > po_qty - gate_entry_qty) {
                                reject(`Gate Entry Quantity is greater than remaining quantity for item code '${row.item}'. Your max entry qty: ${po_qty - gate_entry_qty}`);
                                return;
                            }
                        }
                        else {
                            if (row.qty > po_qty - (received_qty + gate_entry_qty)) {
                                reject(`Gate Entry Quantity is greater than remaining quantity for item code '${row.item}'. Your max entry qty: ${po_qty - (received_qty + gate_entry_qty)}`);
                                return;
                            }
                        }
                        resolve();
                    }
                });
            });

            promises.push(promise);
        });

        // Block save initially
        frappe.validated = false;

        Promise.allSettled(promises).then(results => {
            let errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
            if (errors.length > 0) {
                errors.forEach(msg => frappe.msgprint(msg));
            } else {
                frm._already_validated = true;
                frm.save();
            }
        });
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
                        }
                    });
                } else {
                    frappe.msgprint("Temporary Warehouse not found for this Company!");
                }
            }
        });
        frm.doc.gate_entry_details.forEach(function (row) {
            frappe.call({
                method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.update_po_qty",
                args: {
                    po_name: row.purchase_order,
                    item_code: row.item,
                    qty: row.qty
                },
                callback: function (r) {
                    if (r.message) {
                        // Handle success
                    }
                }
            })
        })
    },
    after_cancel: function (frm) {
        frm.doc.gate_entry_details.forEach(row => {
            frappe.call({
                method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.update_po_after_cancel",
                args: {
                    po_name: row.purchase_order,
                    item_code: row.item,
                    qty: row.qty
                },
                callback: function (r) {
                    if (r.message) {
                        // Optional: show confirmation
                        console.log("PO updated for item:", row.item);
                    }
                }
            });
        });
    },
    validate: function(frm) {
        frm.doc.gate_entry_details.forEach(item => {
            if (item.qty <= 0) {
                frappe.throw(`Item qty cannot be negative for item: ${item.item}`);
            }
        });
    }
})