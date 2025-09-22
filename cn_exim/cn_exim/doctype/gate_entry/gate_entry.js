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
            // Check if GRN already exists for this Gate Entry
            frappe.call({
                method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.check_grn_exists",
                args: {
                    gate_entry_name: frm.doc.name
                },
                callback: function (r) {
                    if (!r.message) { // If GRN doesn't exist, show button
                        frm.add_custom_button("Create GRN", function () {
                            frappe.call({
                                method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.create_purchase_receipt_from_gate_entry",
                                args: {
                                    gate_entry_name: frm.doc.name
                                },
                                callback: function (r) {
                                    if (!r.exc) {
                                        frappe.show_alert(r.message.message, 5);
                                        frappe.set_route("Form", "Purchase Receipt", r.message.purchase_receipt_name);
                                    }
                                }
                            });
                        }, __("Create"));
                    }
                }
            });
            
            // frm.add_custom_button('Quality Inspection', function () {
            //     frappe.call({
            //         method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.create_quality_inspection_from_gate_entry",
            //         args: { gate_entry_name: frm.doc.name },
            //         callback: function(r) {
            //             let created = (r.message && r.message.created) || [];
            //             let existing = (r.message && r.message.existing) || [];
            //             let html = "";
                
            //             if(created.length > 0) {
            //                 html += `<b>Quality Inspection Created for:</b><br>`;
            //                 html += created
            //                     .map(qi => `<a href="/app/quality-inspection/${qi.inspection_name}" target="_blank">${qi.item} (${qi.inspection_name})</a>`)
            //                     .join("<br>") + "<br><br>";
            //             }
            //             if(existing.length > 0) {
            //                 html += `<b>Already Exists:</b><br>`;
            //                 html += existing
            //                     .map(qi => `<a href="/app/quality-inspection/${qi.inspection_name}" target="_blank">${qi.item} (${qi.inspection_name})</a>`)
            //                     .join("<br>");
            //             }
            //             if(!html) html = "No items require Quality Inspection before purchase.";
            //             frappe.msgprint(html);
            //         }
            //     });                
            // }, __("Create"));
        }


        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Get PO Items'), function () {
        if (frm.doc.supplier == undefined || frm.doc.supplier == "") {
            frappe.msgprint("Please select supplier first");
            return;
        } else {
            frappe.call({
                method: "cn_exim.cn_exim.doctype.gate_entry.gate_entry.get_valid_purchase_orders",
                args: {
                    supplier: frm.doc.supplier,
                    company: frm.doc.company
                },
                callback: function (r) {
                    const valid_pos = r.message || [];

                    if (valid_pos.length === 0) {
                        frappe.msgprint("No valid POs found with pending items.");
                        return;
                    }

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
                                    name: ["in", valid_pos]
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

                                    frm.clear_table("gate_entry_details");

                                    po_items_list.forEach(obj => {
                                        let row = frm.add_child("gate_entry_details")
                                        row.purchase_order = obj.purchase_order;
                                        row.item = obj.item;
                                        row.item_name = obj.item_name;
                                        row.uom = obj.uom;
                                        row.rate = obj.rate;
                                        row.amount = obj.amount;
                                        row.rate_inr = obj.rate_inr;
                                        row.amount_inr = obj.amount_inr;
                                        row.po_qty = obj.qty;
                                        row.po_pending_qty = (obj.qty ?? 0) - ((obj.received_qty ?? 0) + (obj.custom_gate_entry_qty ?? 0))
                                        row.grn_panding_qty = obj.qty - obj.received_qty;
                                        row.po_item = obj.name;
                                    });
                                    frm.refresh_field("gate_entry_details");

                                    frm.clear_table("purchase_order_in_gate_entry");

                                    purchase_order.forEach(obj => {
                                        let po_row = frm.add_child("purchase_order_in_gate_entry");
                                        po_row.purchase_order = obj.purchase_order;
                                        po_row.incoming_quantity = obj.incoming_quantity;
                                    });
                                    frm.refresh_field("purchase_order_in_gate_entry");

                                    frm.set_value("supplier", po_details.supplier);
                                    frm.set_value("supplier_name", po_details.supplier_name);
                                    frm.set_value("currency", po_details.currency);
                                    frm.set_value("currency_rate", po_details.conversion_rate);
                                    frm.set_value("cost_center", po_details.cost_center);
                                }
                            });

                            d.dialog.hide();
                        }
                    });

                    const observer = new MutationObserver(() => {
                        const $btn = $('button:contains("Make Purchase Order")');
                        if ($btn.length) {
                            $btn.hide();
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }
    }, __('Get Items From'));
        }

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