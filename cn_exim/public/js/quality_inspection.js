frappe.ui.form.on('Quality Inspection', {
    refresh: function(frm) {
        frm.set_query("item_code", function (doc) {
            let doctype = doc.reference_type;

            if (doc.reference_type === "Gate Entry") {
                doctype = "Gate Entry Details";
            } else if (doc.reference_type !== "Job Card") {
                doctype = doc.reference_type == "Stock Entry"
                    ? "Stock Entry Detail"
                    : doc.reference_type + " Item";
            }

            if (doc.reference_type && doc.reference_name) {
                let filters = {
                    from: doctype,
                    inspection_type: doc.inspection_type,
                };

                if (doc.reference_type == doctype)
                    filters["reference_name"] = doc.reference_name;
                else
                    filters["parent"] = doc.reference_name;

                return {
                    query: "erpnext.stock.doctype.quality_inspection.quality_inspection.item_query",
                    filters: filters,
                };
            }
        });
        
        // Add View Stock Ledger button if Quality Inspection is submitted and has Stock Entry
        if (frm.doc.docstatus === 1 && frm.doc.custom_stock_entry) {
            frm.add_custom_button(__('View Stock Ledger'), function() {
                // Open Stock Ledger report filtered by the Stock Entry with Segregate Serial/Batch Bundle checked
                let url = `/app/query-report/Stock%20Ledger?voucher_no=${frm.doc.custom_stock_entry}&company=${frm.doc.company}&segregate_serial_batch_bundle=1`;
                window.open(url, '_blank');
            }, __('View')).addClass('btn-primary');
        }
        
        // Add Fetch Serial and Batch Bundle button for Purchase Receipt reference type
        if (frm.doc.reference_type === "Purchase Receipt" && frm.doc.child_row_reference && frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Fetch Serial & Batch Bundle'), function() {
                fetch_serial_batch_bundle_data(frm);
            }, __('Actions')).addClass('btn-info');
        }
    },
    
    onload: function (frm) {
        if(frm.doc.reference_type !== "Gate Entry"){
        if (frm.doc.custom_accepted_quantity == undefined || frm.doc.custom_accepted_quantity == 0) {
            frappe.call({
                method: "cn_exim.config.py.quality_inspection.set_value_in_qc_base_on_pr",
                args: {
                    "parent": frm.doc.reference_name,
                    "item_code": frm.doc.item_code,
                    "name": frm.doc.name
                },
                callback: function (r) {
                }
            })
        }
    }
    },
    
    // Expiry date calculation functions
    custom_manufacturing_date: function(frm) {
        calculate_expiry_date(frm);
    },
    
    custom_expiry_in_months: function(frm) {
        calculate_expiry_date(frm);
    },
    
    custom_rejected_quantity: function (frm) {
        if(frm.doc.reference_type === "Purchase Receipt"){
            // For Purchase Receipt reference type
            if (frm.doc.child_row_reference && frm.doc.custom_rejected_quantity !== undefined && frm.doc.custom_rejected_quantity !== null) {
                frappe.call({
                    method: "cn_exim.config.py.quality_inspection.get_purchase_receipt_item_qty",
                    args: {
                        "child_row_reference": frm.doc.child_row_reference,
                        "item_code": frm.doc.item_code,
                    },
                    callback: function (r) {
                        if (r.message && r.message.qty !== undefined) {
                            let received_qty = r.message.qty || 0;
                            let rejected_qty = frm.doc.custom_rejected_quantity || 0;
                            
                            if (rejected_qty > received_qty) {
                                frappe.throw(__("Rejected quantity ({0}) cannot be greater than received quantity ({1}) from Purchase Receipt.", 
                                    [rejected_qty, received_qty]));
                                frm.set_value("custom_rejected_quantity", 0);
                                frm.set_value("custom_accepted_quantity", received_qty);
                            } else {
                                let accepted_qty = received_qty - rejected_qty;
                                frm.set_value("custom_accepted_quantity", accepted_qty);
                                
                                frappe.msgprint({
                                    title: __("Quantity Calculated"),
                                    message: __("Received Quantity: {0}<br>Rejected Quantity: {1}<br>Accepted Quantity: {2}", 
                                        [received_qty, rejected_qty, accepted_qty]),
                                    indicator: 'green'
                                });
                            }
                        } else {
                            frappe.throw(__("Could not find received quantity for this item in Purchase Receipt."));
                        }
                    }
                });
            }
        } else {
            // For other reference types (original logic)
            frappe.call({
                method: "cn_exim.config.py.quality_inspection.get_qty_from_purchase_receipt",
                args: {
                    "parent": frm.doc.reference_name,
                    "item_code": frm.doc.item_code,
                },
                callback: function (r) {
                    if (r.message) {
                        if (r.message[0]['qty'] < frm.doc.custom_rejected_quantity) {
                            frappe.throw(__("Rejected quantity cannot be greater than Purchase Receipt quantity."))
                            frm.set_value("custom_rejected_quantity", 0);
                        }
                        else {
                            let accepted_qty = r.message[0]['qty'] - frm.doc.custom_rejected_quantity;
                            frm.set_value("custom_accepted_quantity", accepted_qty)
                        }
                    }
                }
            })
        }
    },
    custom_accepted_quantity: function (frm) {
        // Additional validation for accepted quantity
        if (frm.doc.custom_accepted_quantity && frm.doc.custom_rejected_quantity && frm.doc.reference_type === "Gate Entry") {
            let total_qty = frm.doc.custom_accepted_quantity + frm.doc.custom_rejected_quantity;
            
            // Get received quantity to validate
            if (frm.doc.custom_gate_entry_child) {
                frappe.call({
                    method: "cn_exim.config.py.quality_inspection.get_gate_entry_received_qty",
                    args: {
                        "gate_entry_child": frm.doc.custom_gate_entry_child,
                        "item_code": frm.doc.item_code,
                    },
                    callback: function (r) {
                        if (r.message && r.message.received_qty) {
                            let received_qty = r.message.received_qty;
                            
                            if (total_qty > received_qty) {
                                frappe.throw(__("Total quantity (Accepted: {0} + Rejected: {1} = {2}) cannot exceed received quantity ({3}) from Gate Entry.", 
                                    [frm.doc.custom_accepted_quantity, frm.doc.custom_rejected_quantity, total_qty, received_qty]));
                            }
                        }
                    }
                });
            }
        }
    },

    on_submit: function (frm) {
        if(frm.doc.reference_type !== "Gate Entry"){
        frappe.call({
            method: "cn_exim.config.py.quality_inspection.update_purchase_receipt",
            args: {
                "parent": frm.doc.reference_name,
                "item_code": frm.doc.item_code,
                "accepted_qty": frm.doc.custom_accepted_quantity,
                "rejected_qty": frm.doc.custom_rejected_quantity
            },
            callback: function (r) {
                if (r.message) {
                    frappe.msgprint("Purchase Receipt updated successfully.");
                }
            }
        });
    }
    }
});

// Helper function to calculate expiry date
function calculate_expiry_date(frm) {
    // Check if both manufacturing date and expiry months are provided
    if (frm.doc.custom_manufacturing_date && frm.doc.custom_expiry_in_months) {
        
        // Calculate expiry date
        let manufacturing_date = new Date(frm.doc.custom_manufacturing_date);
        let expiry_date = new Date(manufacturing_date);
        expiry_date.setMonth(expiry_date.getMonth() + parseInt(frm.doc.custom_expiry_in_months));
        
        // Format date to YYYY-MM-DD
        let formatted_expiry_date = expiry_date.toISOString().split('T')[0];
        
        // Set the calculated expiry date
        frm.set_value("custom_expiry_date", formatted_expiry_date);
        
        // Show success message
        frappe.msgprint({
            title: __("Expiry Date Calculated"),
            message: __("Expiry Date: {0}<br>Manufacturing Date: {1}<br>Expiry Period: {2} months", 
                [formatted_expiry_date, frm.doc.custom_manufacturing_date, frm.doc.custom_expiry_in_months]),
            indicator: 'green'
        });
        
    } else if (frm.doc.custom_manufacturing_date && !frm.doc.custom_expiry_in_months) {
        // Clear expiry date if manufacturing date is set but months are not
        frm.set_value("custom_expiry_date", "");
        
    } else if (!frm.doc.custom_manufacturing_date && frm.doc.custom_expiry_in_months) {
        // Clear expiry date if months are set but manufacturing date is not
        frm.set_value("custom_expiry_date", "");
        frappe.msgprint(__("Please enter Manufacturing Date to calculate Expiry Date."), __("Info"));
    }
}

// Function to fetch Serial and Batch Bundle data
function fetch_serial_batch_bundle_data(frm) {
    if (!frm.doc.child_row_reference) {
        frappe.msgprint(__("Please select a Child Row Reference first."), __("Info"));
        return;
    }
    
    frappe.call({
        method: "cn_exim.overrides.quality_inspection.fetch_serial_batch_bundle_data",
        args: {
            "child_row_reference": frm.doc.child_row_reference,
            "reference_name": frm.doc.reference_name
        },
        callback: function (r) {
            if (r.message && r.message.success) {
                // Update the fields with fetched data
                if (r.message.serial_and_batch_bundle) {
                    frm.set_value("custom_serial_and_batch_bundle", r.message.serial_and_batch_bundle);
                }
                if (r.message.batch_no) {
                    frm.set_value("batch_no", r.message.batch_no);
                }
                
                frappe.msgprint({
                    title: __("Data Fetched Successfully"),
                    message: __("Serial and Batch Bundle: {0}<br>Batch Number: {1}", 
                        [r.message.serial_and_batch_bundle || "Not found", r.message.batch_no || "Not found"]),
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __("No Data Found"),
                    message: __("No Serial and Batch Bundle data found for this item."),
                    indicator: 'orange'
                });
            }
        }
    });
}