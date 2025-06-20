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
                                    frm.set_value("payment_terms_template", data['payment_terms_template'])
                                }

                            }
                        })
                    }
                })
            }
        }
        frm.set_query("custom_parent_cost_center", function() {
            return {
                "filters": {
                    "is_group": 1
                }
            };
        });

        frm.set_query("segment", function() {
            return {
                "filters": {
                    'parent_segment': frm.doc.custom_parent_cost_center,
                    "is_group": 0,
                    "disable": 0

                }
            };
        });

        console.log("Onload: Queries set for custom_cc and segment fields");
        // Set query for custom_cc field in the child table
        frm.fields_dict["items"].grid.get_field("custom_parent_cost_centre").get_query = function() {
            return {
                filters: {
                    is_group: 1
                }
            };
        };

        // Set query for custom_cost_centre field in the child table
        frm.fields_dict["items"].grid.get_field("segment").get_query = function(doc, cdt, cdn) {
            var child = locals[cdt][cdn];
            return {
                filters: {
                    parent_segment: child.custom_parent_cost_centre,
                    is_group: 0,
                    disable: 0
                }
            };
        };
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
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button("Landed Cost Voucher", function () {
                if (!frm.doc.custom_purchase_order) {
                    let po_list = [];
                    let all_purchase_receipts = [];
                    let all_expenses = [];
                    let all_purchase_invoices = [];

                    frm.doc.items.forEach(element => {
                        if (element.custom_po_number) {
                            if (!po_list.includes(element.custom_po_number)) {
                                po_list.push(element.custom_po_number);
                            }

                            all_expenses.push({
                                expense_account: element.expense_account,
                                description: element.description,
                                amount: element.amount,
                            });

                        }
                    });
                    frm.doc.taxes.forEach(element => {
                        all_expenses.push({
                            expense_account: element.account_head,
                            description: element.description,
                            amount: element.tax_amount,
                        });
                    })

                    // Add Purchase Invoice (only one)
                        all_purchase_invoices.push({
                            purchase_invoice: frm.doc.name,
                            supplier: frm.doc.supplier,
                            amount: frm.doc.grand_total,
                            posting_date: frm.doc.posting_date,
                        });
                    // Correct way: loop through Object.entries()


                    po_list.forEach(po_number => {
                        frappe.call({
                            method: "cn_exim.config.py.purchase_invoice.get_landed_cost_voucher_details",
                            args: {
                                purchase_invoice_name: frm.doc.name,
                                custom_purchase_order: po_number
                            },
                            callback: function (r) {
                                const data = r.message; // Assuming this is your response

                                // Add Purchase Receipt
                                if (data[0] && data[0].length) {
                                    data[0].forEach(pr => {
                                        // Check if the receipt already exists in all_purchase_receipts
                                        const exists = all_purchase_receipts.some(item => item.receipt_document === pr.name);
                                        if (!exists) {
                                            all_purchase_receipts.push({
                                                receipt_document_type: 'Purchase Receipt',
                                                receipt_document: pr.name,
                                            });
                                        }
                                    });
                                }

                                // After processing all PO numbers, create Landed Cost Voucher
                                if (Object.entries(po_list).length === Object.keys(all_purchase_receipts).length) {
                                    // Create the Landed Cost Voucher once all POs are processed
                                    frappe.call({
                                        method: "frappe.client.insert",
                                        args: {
                                            doc: {
                                                doctype: "Landed Cost Voucher",
                                                naming_series: "LCV-.YYYY.-",
                                                company: frm.doc.company, // put your company
                                                posting_date: frappe.datetime.get_today(),
                                                distribute_charges_based_on: "Amount",
                                                purchase_receipts: all_purchase_receipts,
                                                taxes: all_expenses,
                                                custom_purchase_invoice_details: all_purchase_invoices,
                                            }
                                        },
                                        callback: function(r) {
                                            if (!r.exc) {
                                                frappe.msgprint(`Landed Cost Voucher ${r.message.name} created`);
                                                frappe.set_route("Form", "Landed Cost Voucher", r.message.name);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    });

                }
                else {
                    frappe.call({
                        method: "cn_exim.config.py.purchase_invoice.get_landed_cost_voucher_details",
                        args: {
                            purchase_invoice_name: frm.doc.name,
                            // purchase_invoice_items:frm.doc.items,
                            custom_purchase_order: frm.doc.custom_purchase_order
                        },
                        callback: function (r) {
                            if (r.exc) {
                                frappe.throw("Error: " + r.exc);
                                return;
                            }
                            let purchase_receipts = r.message[0]
                            let taxes_data = r.message[1] || [];
                            let purchase_invoice_details = r.message[2] || []
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
                                pi_details_rows = purchase_invoice_details.map(pi => {
                                    return {
                                        purchase_invoice: pi.purchase_invoice,
                                        expense_account: pi.expense_account,
                                        amount: pi.amount,
                                        supplier: pi.supplier,
                                        date: pi.date,
                                        item: pi.item,
                                    }
                                })
                            }

                            if (purchase_receipt_rows.length > 0) {
                                frappe.call({
                                    method: "frappe.client.insert",
                                    args: {
                                        doc: {
                                            'doctype': "Landed Cost Voucher",
                                            'distribute_charges_based_on': "Amount",
                                            'purchase_receipts': purchase_receipt_rows,
                                            'taxes': taxes_rows,
                                            'custom_purchase_invoice_details': pi_details_rows
                                        }
                                    },
                                    callback: function (r) {

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
                }

            }, __("Create"))
        }



        frm.add_custom_button("BOE Entry", function () {
            var d = new frappe.ui.form.MultiSelectDialog({
                doctype: "BOE Entry",
                target: this.cur_frm,
                setters: {
                    vendor: null,
                    boe_date: null,
                },
                add_filters_group: 1,
                columns: ["name", "boe_date", "vendor"],
                get_query() {
                    return {
                        filters: [
                            ["docstatus", "=", 1],
                            ["status", "!=", "To Bill"]
                        ]
                    };
                },
                action(selections) {
                    var length = selections.length
                    if (length > 0) {
                        frappe.call({
                            method: "cn_exim.config.py.purchase_invoice.get_invoice_data_for_import",
                            args: {
                                boe_list: selections
                            },
                            callback: function (r) {
                                frm.set_value("supplier", r.message[1])
                                frm.set_value("currency", r.message[2])

                                frm.clear_table("items");

                                row_list = r.message[0]
                                row_list.forEach(obj => {
                                    let row = frm.add_child("items");

                                    frappe.call({
                                        method: "frappe.client.get_value",
                                        args: {
                                            doctype: "Item",
                                            filters: {
                                                name: obj.item_code
                                            },
                                            fieldname: ["item_name", "stock_uom"]   // ✅ (not 'filed', should be 'fieldname')
                                        },
                                        callback: function (r) {
                                            if (r.message) {
                                                row.item_name = r.message.item_name;
                                                row.uom = r.message.stock_uom;
                                                frm.refresh_field("items");
                                            }
                                        }
                                    });

                                    // Set other fields
                                    row.custom_po_number = obj.custom_po_number;
                                    row.custom_boe_entry = obj.custom_boe_entry;
                                    row.item_code = obj.item_code;
                                    row.rate = obj.rate;
                                    row.amount = obj.amount;
                                    row.description = obj.description;
                                    row.qty = obj.qty;
                                })
                                frm.refresh_field("items")
                            }
                        })
                    }
                    d.dialog.hide();
                }
            });
        }, __("Get Items From"))

        // Function to generate table rows for each item in the Purchase Invoice
        function generateItemRows(items) {
            let rows = '';
            if (items && items.length > 0) {
                items.forEach(function(item) {
                    rows += `
                    <tr>
                        <td>${item.item_code}</td>
                        <td>${item.expense_head || item.expense_account || 'N/A'}</td>
                        <td>${item.qty}</td>
                        <td>${item.rate}</td>
                        <td>${item.amount}</td>

                    </tr>
                    `;
                });
            } else {
                rows += `
                <tr>
                    <td colspan="5">No items available.</td>
                </tr>
                `;
            }
            return rows;
        }

        // Function to generate GST rows
        function generateGSTRows(taxes) {
            let rows = '';
            if (taxes && taxes.length > 0) {
                taxes.forEach(function(tax) {
                    rows += `
                    <tr>
                        <td>${tax.account_head}</td>
                        <td>${tax.rate || '0.00'}%</td>
                        <td>${tax.tax_amount || '0.00'}</td>
                        <td>${tax.description || 'N/A'}</td>
                    </tr>
                    `;
                });
            } else {
                rows += `
                <tr>
                    <td colspan="4">No GST details available.</td>
                </tr>
                `;
            }
            return rows;
        }

        // Function to generate the summary rows
        function generateSummaryRows(doc) {
            return `
            <tr>
                <td colspan="4" style="text-align:right;"><strong>Total Amount:</strong></td>
                <td>${doc.total || '0.00'}</td>
            </tr>
            <tr>
                <td colspan="4" style="text-align:right;"><strong>Total Taxes and Charges:</strong></td>
                <td>${doc.total_taxes_and_charges || '0.00'}</td>
            </tr>
            <tr>
                <td colspan="4" style="text-align:right;"><strong>Grand Total:</strong></td>
                <td>${doc.grand_total || '0.00'}</td>
            </tr>
            <tr>
                <td colspan="6" style="text-align:left;"><strong>Amount in Words:</strong> ${doc.in_words || 'Zero'}</td>
            </tr>
            `;
        }

        // Main HTML content for the custom Purchase Invoice section
        let table_html = `
        <style>
            .custom-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .custom-table th, .custom-table td {
                padding: 10px;
                text-align: left;
                border: 1px solid #ddd;
            }
            .custom-table th {
                background-color: #f4f4f4;
                color: #333;
                font-weight: bold;
            }
            .custom-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .custom-table tr:hover {
                background-color: #e0e0e0;
            }
            .table-title {
                margin-top: 20px;
                font-size: 16px;
                font-weight: bold;
                text-align: left;
            }
            .custom-invoice-details {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.custom-invoice-detail {
    flex: 1;
    min-width: 200px;
    padding: 8px;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

        </style>

<div class="custom-invoice-info">
    <h3>Invoice Summary</h3>
    <div class="custom-invoice-details">
        <div class="custom-invoice-detail">
            <p><strong>Invoice Number:</strong> ${frm.doc.name || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Date:</strong> ${frm.doc.posting_date || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Created By:</strong> ${frm.doc.owner || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Workflow State:</strong> ${frm.doc.workflow_state || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Supplier:</strong> ${frm.doc.supplier || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Tally Invoice No:</strong> ${frm.doc.tally_invoice_number_refrence || 'N/A'}</p>
        </div>

        <div class="custom-invoice-detail">
            <p><strong>Supplier Invoice No:</strong> ${frm.doc.bill_no || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Supplier Invoice Date:</strong> ${frm.doc.bill_date || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Segment:</strong> ${frm.doc.segment || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Cost Center:</strong> ${frm.doc.cost_center || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Billing Address:</strong> ${frm.doc.billing_address_display || 'N/A'}</p>
        </div>
        <div class="custom-invoice-detail">
            <p><strong>Shipping Address:</strong> ${frm.doc.shipping_address_display || 'N/A'}</p>
        </div>
    </div>
</div>


        <h3 class="table-title">Item Details</h3>
        <table class="custom-table">
            <thead>
                <tr>
                    <th>Item Code</th>
                    <th>Expense Head</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>

                </tr>
            </thead>
            <tbody>
                ${generateItemRows(frm.doc.items)}
                ${generateSummaryRows(frm.doc)}
            </tbody>
        </table>

        <h3 class="table-title">GST Details</h3>
        <p><strong>Taxes and Charges Template:</strong> ${frm.doc.taxes_and_charges || 'N/A'}</p>
        <table class="custom-table">
            <thead>
                <tr>
                    <th>Account Head</th>
                    <th>Rate (%)</th>
                    <th>Tax Amount</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                ${generateGSTRows(frm.doc.taxes)}
            </tbody>
        </table>
        `;

        // Insert the generated HTML into the custom field
        frm.fields_dict.custom_custom_table.$wrapper.html(table_html);
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
    on_submit:function(frm){
        boe_list = []
        $.each(frm.doc.items || [], function (i, d) {
            if (d.custom_boe_entry) {
                boe_list.push(d.custom_boe_entry)
            }
        })
        if (boe_list.length > 0) {
            frappe.call({
                method: "cn_exim.config.py.purchase_invoice.update_boe_entry",
                args: {
                    boe_list: boe_list,
                },
                callback: function (r) {
                    if (!r.exc) {
                        frappe.msgprint("BOE Entry updated successfully");
                    }
                }
            })
        }
    },
    item_group: function(frm) {
        frm.set_query("segment", function() {
            return {
                "filters": {
                    'parent_segment': frm.doc.custom_parent_cost_center,
                    "is_group": 0,
                    "disable": 0
                }
            };
        });
    },
    custom_parent_cost_center: function(frm, cdt, cdn) {
        frm.set_query("segment", function() {
            return {
                "filters": {
                    'parent_segment': frm.doc.custom_parent_cost_center,
                    "is_group": 0,
                    "disable": 0
                }
            };
        });

        var child = locals[cdt][cdn];
        frappe.ui.form.on('Purchase Invoice Item', {
            custom_parent_cost_centre: function(frm, cdt, cdn) {
                var child = locals[cdt][cdn];
                frm.fields_dict["items"].grid.get_field("segment").get_query = function() {
                    return {
                        filters: {
                            parent_segment: child.custom_parent_cost_centre,
                            is_group: 0,
                            disable: 0
                        }
                    };
                };
            }
        });
    }
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



frappe.ui.form.on('Purchase Invoice Item', {
    item_tax_template: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        let rate = item.rate;
        let item_tax_template = item.item_tax_template;

        if (item_tax_template) {
            frappe.db.get_doc('Item Tax Template', item_tax_template)
                .then(doc => {
                    if (doc && doc.gst_rate) {
                        let gst_rate = doc.gst_rate;
                        let gst_rate_with_percentage = `${gst_rate}%`;
                        let gst_rate_number = parseFloat(gst_rate);
                        let calculated_value = (rate * gst_rate_number) / 100;
                        frappe.model.set_value(cdt, cdn, 'custom_calculated_value', calculated_value);

                        // Check if the 'custom_gst_not_receivable' checkbox is checked
                        if (item.custom_gst_not_receivable) {
                            // Add the calculated value to the rate
                            let new_rate = rate + calculated_value;
                            frappe.model.set_value(cdt, cdn, 'rate', new_rate);
                            frappe.model.set_value(cdt, cdn, 'item_tax_template', '');
                        }

                        console.log('Rate:', rate);
                        console.log('GST Rate with Percentage:', gst_rate_with_percentage);
                        console.log('Calculated Value:', calculated_value);
                    }
                });
        } else {
            console.log('Rate:', rate);
            console.log('GST Rate with Percentage: No Tax Template');
        }
    },

    custom_gst_not_receivable: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        let rate = item.rate;
        let calculated_value = item.custom_calculated_value;

        // Check if the checkbox is checked
        if (item.custom_gst_not_receivable) {
            // Add the calculated value to the rate
            let new_rate = rate + calculated_value;
            frappe.model.set_value(cdt, cdn, 'rate', new_rate);
            frappe.model.set_value(cdt, cdn, 'item_tax_template', '');
        }
    }
});
