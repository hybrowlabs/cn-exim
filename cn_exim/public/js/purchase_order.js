frappe.ui.form.on("Purchase Order", {
    refresh: function (frm) {
        if (frm.doc.custom_purchase_sub_type == "Import" && frm.doc.docstatus == 1) {
            frm.add_custom_button("Pickup Request", function () {
                let purchase_order_list = [{
                    po_number: frm.doc.name,
                    currency: frm.doc.currency,
                }];

                let po_item_details = [];

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
                    });
                });

                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Pickup Request",
                            name_of_supplier: frm.doc.supplier,
                            supplier_address: frm.doc.supplier_address,
                            purchase_order_list: purchase_order_list,
                            purchase_order_details: po_item_details,
                            remarks: "test",
                            total_amount: frm.doc.total
                        }
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route("Form", "Pickup Request", r.message.name);
                        }
                    }
                });

            }, __("Create"));
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
                let purchase_order_details = []
                let qty = 0
                let received_qty = 0


                frm.doc.items.forEach(element => {
                    let qty = element.qty - element.received_qty
                    get_entry_details.push({
                        "purchase_order": frm.doc.name,
                        "item": element.item_code,
                        "item_name": element.item_name,
                        "uom": element.uom,
                        "rate": element.rate,
                        "amount": element.base_rate,
                        "qty": qty,
                        "rate_inr": element.amount,
                        "amount_inr": element.base_amount,
                        "po_qty": element.qty,
                    })
                })
                frm.doc.items.forEach(obj => {
                    qty += obj.qty
                    received_qty += obj.received_qty
                })

                let finial_qty = qty - received_qty
                purchase_order_details.push({
                    "purchase_order": frm.doc.name,
                    "incoming_quantity": finial_qty
                })
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            "doctype": "Gate Entry",
                            "supplier": frm.doc.supplier,
                            "supplier_name": frm.doc.supplier_name,
                            "gate_entry_details": get_entry_details,
                            "purchase_order_in_gate_entry": purchase_order_details
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

        if (frm.doc.custom_purchase_extra_charge && frm.doc.custom_purchase_extra_charge.length !== 0 && frm.doc.docstatus === 1) {
            frm.add_custom_button("Extra Purchase Invoice", function () {
                let supplier_grouped_items = {}
                frm.doc.custom_purchase_extra_charge.forEach(item => {
                    if (!supplier_grouped_items[item.supplier]) {
                        supplier_grouped_items[item.supplier] = []
                    }
                    supplier_grouped_items[item.supplier].push({
                        // "purchase_order":frm.doc.name,
                        "item_code": item.item_code,
                        "rate": item.amount,
                        "amount": item.amount,
                        "qty": 1,
                        "expense_account": item.account_head
                    })
                })
                Object.keys(supplier_grouped_items).forEach(supplier => {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                "doctype": "Purchase Invoice",
                                "supplier": supplier,
                                "items": supplier_grouped_items[supplier],
                                "custom_purchase_order": frm.doc.name
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

        if (frm.doc.docstatus === 0 && frm.doc.status === "Draft" && !frm.is_new()) {
            frm.add_custom_button("Update Rate", function () {
                frm.doc.items.forEach(function (item) {
                    if (item.item_code) {
                        frappe.call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "Item Price",
                                filters: {
                                    item_code: item.item_code,
                                    buying: 1,
                                },
                                fields: ["price_list_rate"],
                                order_by: "creation desc",
                                limit_page_length: 1
                            },
                            callback: function (response) {
                                if (response.message && response.message.length > 0) {
                                    let price = response.message[0].price_list_rate;
                                    frappe.model.set_value(item.doctype, item.name, "rate", price);
                                }
                            }
                        });
                    }
                });
            })
        }

        if (frm.doc.segment) {
            frm.doc.items.forEach(function (item) {
                item.segment = frm.doc.segment;
            });
        }

        if (frm.doc.custom_cc) {
            frm.doc.items.forEach(function (item) {
                item.custom_parent_cost_center = frm.doc.custom_cc;
            });
        }

        frm.refresh_field('items');
        function generateItemRows(items) {
            let rows = '';
            if (items && items.length > 0) {
                items.forEach(function (item) {
                    rows += `
                        <tr>
                            <td>${item.item_code}</td>
                            <td>${item.item_name}</td>
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

        // Function to generate the summary rows (total amount, taxes, grand total, amount in words)
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
                    <td colspan="5" style="text-align:left;"><strong>Amount in Words &nbsp;:&nbsp;&nbsp; ${doc.in_words || 'Zero'}</strong></td>

                </tr>
                `;
        }

        // Main HTML content for the custom Purchase Order section
        let table_html = `
            <style>
                .custom-purchase-order-info {
                    margin: 20px 0;
                    font-family: Arial, sans-serif;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    padding: 10px;
                    background-color: #f4f4f4;
                }
                .custom-purchase-order-info h3 {
                    margin: 0;
                    padding: 10px;
                    background-color: white;
                    color: black;
                    border-radius: 5px;
                    font-size: 16px;
                    text-align: center;
                }
                .custom-purchase-order-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin: 10px 0;
                }
                .custom-purchase-order-detail {
                    flex: 1;
                    min-width: 200px;
                    padding: 10px;
                    background-color: white;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .custom-purchase-order-detail p {
                    margin: 5px 0;
                    font-size: 14px;
                }
                .custom-purchase-order-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                .custom-purchase-order-table th, .custom-purchase-order-table td {
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                .custom-purchase-order-table th {
                    background-color: #f4f4f4;
                    color: #333;
                    font-weight: bold;
                }
                .custom-purchase-order-table tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .custom-purchase-order-table tr:hover {
                    background-color: #e0e0e0;
                }
            </style>

            <div class="custom-purchase-order-info">
                <h3>Summary</h3>
                <div class="custom-purchase-order-details">
                    <div class="custom-purchase-order-detail">
                        <p><strong>Purchase Order Number:</strong> ${frm.doc.name || 'N/A'}</p>
                    </div>
                    <div class="custom-purchase-order-detail">
                        <p><strong>Date:</strong> ${frm.doc.transaction_date || 'N/A'}</p>
                    </div>
                    <div class="custom-purchase-order-detail">
                        <p><strong>Created By:</strong> ${frm.doc.owner || 'N/A'}</p>
                    </div>
                    <div class="custom-purchase-order-detail">
                        <p><strong>Workflow State:</strong> ${frm.doc.workflow_state || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <table class="custom-purchase-order-table">
                <thead>
                    <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
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
            `;

        // Insert the generated HTML into the custom field
        frm.fields_dict.custom_custom_table.$wrapper.html(table_html);
    },
    supplier: function (frm) {
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Supplier",
                filters: {
                    name: frm.doc.supplier
                },
                fieldname: ["supplier_group", "custom_default_delivery_terms_template", "custom_delivery_terms"]
            },
            callback: function (response) {
                console.log("response", response.message["supplier_group"])


                if (response.message['supplier_group'] == "Domestic Material") {
                    let type = response.message['supplier_group']
                    // setInterval(function () {
                    // set_filter_item_supplier_group_wise(type, frm)
                    // }, 500);
                }

                //fetching delivery terms template from supplier master

                if (response.message['custom_default_delivery_terms_template']) {
                    frm.set_value("custom_delivery_term", response.message['custom_default_delivery_terms_template'])
                    frm.set_value("custom_delivery_terms", response.message['custom_delivery_terms'])
                }


            }
        })



    },
    custom_freight: function (frm) {
        freight_amt_calculation(frm);
    },
    custom_packaging: function (frm) {
        package_amt_calculation(frm);
    },
    custom_development: function (frm) {
        development_amt_calculation(frm);
    },
    custom_miscellaneous: function (frm) {
        miscellaneous_amt_calculation(frm);
    },
    after_save: function (frm) {
        let freight_amount = isNaN(frm.doc.custom_freight) ? 0 : frm.doc.custom_freight
        let packaging_amount = isNaN(frm.doc.custom_packaging) ? 0 : frm.doc.custom_packaging
        let development_amount = isNaN(frm.doc.custom_development) ? 0 : frm.doc.custom_development
        let miscellaneous_amount = isNaN(frm.doc.custom_miscellaneous) ? 0 : frm.doc.custom_miscellaneous
        let amount = 0
        frm.doc.items.forEach(row => {
            if (row.amount) {
                amount += isNaN(row.amount) ? 0 : row.amount
            }
        })
        let total = freight_amount + packaging_amount + development_amount + miscellaneous_amount + amount
        frappe.call({
            method: "cn_exim.config.py.purchase_order.update_total_amount",
            args: {
                purchase_order_name: frm.doc.name,
                total_amount: total,
                total_taxes_and_charges: frm.doc.total_taxes_and_charges,
                rounding_adjustment: frm.doc.rounding_adjustment,
            },
            callback: function (response) {
                if (!response.exc) {
                    frm.refresh_field("total");
                    frm.refresh_field("net_total")
                }
            }
        })
    },
    onload: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Item",
                    filters: {
                        name: item.item_code
                    },
                    fieldname: "item_group"
                },
                callback: function (response) {
                    let item_group = response.message.item_group;
                    if (item_group == "Raw Material") {
                        frm.fields_dict['items'].grid.grid_rows_by_docname[item.name].toggle_editable('rate', false)
                    }
                }
            })
        })

        if (frm.doc.docstatus === 0) {  // 0 indicates draft, not submitted
            // Loop through all the items in the Purchase Order
            frm.doc.items.forEach(function (item) {
                if (item.material_request) {
                    // Fetch both custom_line_of_business and custom_cost_centre from the linked Material Request
                    frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            'doctype': 'Material Request',
                            'fieldname': ['custom_line_of_business', 'custom_cost_centre'],
                            'filters': {
                                'name': item.material_request
                            }
                        },
                        callback: function (r) {
                            if (r.message) {
                                // Set the fetched value into the cost_center field
                                if (r.message.custom_line_of_business) {
                                    frm.set_value('cost_center', r.message.custom_line_of_business);
                                }
                                // Set the fetched value into the segment field
                                if (r.message.custom_cost_centre) {
                                    frm.set_value('segment', r.message.custom_cost_centre);
                                }
                            }
                        }
                    });
                }
            });
        }
        frm.set_query("custom_cc", function () {
            return {
                "filters": {
                    "is_group": 1
                }
            };
        });
        frm.set_query("set_warehouse", function () {
            return {
                "filters": {
                    'parent_warehouse': frm.doc.custom_group_warehouse,
                    "is_group": 0,
                }
            };
        });

        frm.set_query("custom_group_warehouse", function () {
            return {
                "filters": {
                    "is_group": 1,
                }
            };
        });

        // Set query for segment field
        frm.set_query("segment", function () {
            return {
                "filters": {
                    'parent_segment': frm.doc.custom_cc,
                    "is_group": 0,
                    "disable": 0

                }
            };
        });

        // Remove the existing 'Payment Request' button
        frm.page.remove_inner_button('Payment Request', 'Create');

        // Add a new 'Payment Request' button with custom behavior
        if(frm.doc.docstatus === 1) {
        frm.page.add_inner_button(__('Payment Request'), function () {
            console.log('Payment Request button clicked');
            frappe.call({
                method: 'erpnext.accounts.doctype.payment_request.payment_request.make_payment_request',
                args: {
                    dt: 'Purchase Order',
                    dn: frm.doc.name
                },
                callback: function (response) {
                    console.log('Payment Request created', response);
                    if (response.message) {
                        var payment_request = frappe.model.sync(response.message)[0];

                        // Ensure custom_payment_schedule exists
                        if (!payment_request.custom_payment_schedule) {
                            payment_request.custom_payment_schedule = [];
                        }

                        // Variable to accumulate the total advance payment amount
                        var total_advance_payment = 0;

                        // Function to process each schedule item
                        function processScheduleItem(schedule, callback) {
                            var custom_schedule = frappe.model.add_child(payment_request, 'Custom Payment Schedule', 'custom_payment_schedule');
                            custom_schedule.payment_term = schedule.payment_term;
                            custom_schedule.due_date = schedule.due_date;
                            custom_schedule.invoice_portion = schedule.invoice_portion;
                            custom_schedule.payment_amount = schedule.payment_amount;
                            custom_schedule.description = schedule.description;

                            // Check if the payment term is an advance
                            frappe.db.get_value('Payment Term', schedule.payment_term, 'custom_is_advance', function (value) {
                                if (value && value.custom_is_advance) {
                                    total_advance_payment += schedule.payment_amount;
                                }
                                callback();
                            });
                        }

                        // Copy payment_schedule data to custom_payment_schedule in Payment Request
                        if (frm.doc.payment_schedule && frm.doc.payment_schedule.length > 0) {
                            let processed_count = 0;

                            frm.doc.payment_schedule.forEach(function (schedule) {
                                processScheduleItem(schedule, function () {
                                    processed_count++;
                                    if (processed_count === frm.doc.payment_schedule.length) {
                                        // All items processed, print the total advance payment
                                        console.log('Total Advance Payment:', total_advance_payment);

                                        // Set the grand_total field in Payment Request
                                        payment_request.grand_total = total_advance_payment;

                                        // Convert grand_total to words
                                        payment_request.custom_in_words = numberToWords(total_advance_payment);

                                        // Save the Payment Request and update additional fields
                                        frappe.call({
                                            method: 'frappe.client.save',
                                            args: {
                                                doc: payment_request
                                            },
                                            callback: function (save_response) {
                                                console.log('Payment Request saved', save_response);

                                                // Update additional fields
                                                frappe.call({
                                                    method: 'frappe.client.set_value',
                                                    args: {
                                                        doctype: 'Payment Request',
                                                        name: payment_request.name,
                                                        fieldname: 'reference_doctype',
                                                        value: 'Purchase Order'
                                                    },
                                                    callback: function () {
                                                        frappe.call({
                                                            method: 'frappe.client.set_value',
                                                            args: {
                                                                doctype: 'Payment Request',
                                                                name: payment_request.name,
                                                                fieldname: 'party_type',
                                                                value: 'Supplier'
                                                            },
                                                            callback: function () {
                                                                frappe.call({
                                                                    method: 'frappe.client.set_value',
                                                                    args: {
                                                                        doctype: 'Payment Request',
                                                                        name: payment_request.name,
                                                                        fieldname: 'payment_request_type',
                                                                        value: 'Outward'
                                                                    },
                                                                    callback: function () {
                                                                        // Set the party field to the supplier value from the Purchase Order
                                                                        frappe.call({
                                                                            method: 'frappe.client.set_value',
                                                                            args: {
                                                                                doctype: 'Payment Request',
                                                                                name: payment_request.name,
                                                                                fieldname: 'party',
                                                                                value: frm.doc.supplier
                                                                            },
                                                                            callback: function () {
                                                                                // Redirect to the Payment Request form
                                                                                frappe.set_route('Form', payment_request.doctype, payment_request.name);
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            });
                        }
                    } else {
                        console.error('Failed to create Payment Request');
                    }
                }
            });
        }, 'Create');
        }
    },
    validate: function (frm) {
        // Check if the Purchase Order is already submitted
        if (frm.doc.docstatus === 1) {  // 1 indicates submitted
            frappe.msgprint(__('Cannot update segment after submission.'));
            frappe.validated = false;
        }
    },
    cost_center: function (frm) {
        let Segment = frm.doc.cost_center;

        frm.doc.items.forEach(function (item) {
            item.cost_center = Segment;
        });
    },
    custom_group_warehouse: function (frm) {

        let group_warehouse = frm.doc.custom_group_warehouse;


        frm.doc.items.forEach(function (item) {
            item.custom_group_warehouse = group_warehouse;
        });


        frm.refresh_field('items');
    },
    segment: function (frm) {
        let customCostCentre = frm.doc.segment;

        frm.doc.items.forEach(function (item) {
            item.segment = customCostCentre;
        });
    },

    custom_cc: function (frm) {
        let customCC = frm.doc.custom_cc;

        frm.doc.items.forEach(function (item) {
            item.custom_parent_cost_center = customCC;
        });
    },
})


frappe.ui.form.on('Purchase Order Item', {
    item_code: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        // Fetch item group to determine if it is a material or service
        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item",
                filters: { name: row.item_code },
                fieldname: "item_group"
            },
            callback: function (response) {
                if (response.message) {
                    let item_group = response.message.item_group;
                    console.log(item_group)
                    if (item_group === "Raw Material") {
                        frm.fields_dict['items'].grid.grid_rows_by_docname[row.name].toggle_editable('rate', false);
                    } else {
                        frm.fields_dict['items'].grid.grid_rows_by_docname[row.name].toggle_editable('rate', true);
                    }
                }
            }
        });
    },
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
    },
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
        frm.fields_dict['items'].grid.get_field('item_code').get_query = function (doc, cdt, cdn) {
            return {
                filters: {
                    is_stock_item: 1
                }
            };
        };
    } else if (frm.doc.type == "Domestic Service") {
        console.log("Type selected:", frm.doc.type);
        frm.fields_dict['items'].grid.get_field('item_code').get_query = function (doc, cdt, cdn) {
            return {
                filters: {
                    is_stock_item: 0
                }
            };
        };
    }
}



function freight_amt_calculation(frm) {
    let freight_amount = isNaN(frm.doc.custom_freight) ? 0 : frm.doc.custom_freight
    let total = 0;
    frm.doc.items.forEach(function (row) {
        if (row.amount) {
            total += row.amount;
        }
    });

    frm.doc.items.forEach(row => {
        let freight_per_item = (row.amount / total) * freight_amount;
        frappe.model.set_value(row.doctype, row.name, "custom_freight", freight_per_item)
    })
    frm.refresh_field("items");
}

function package_amt_calculation(frm) {
    let packaging_amount = isNaN(frm.doc.custom_packaging) ? 0 : frm.doc.custom_packaging
    let total = 0;
    frm.doc.items.forEach(function (row) {
        if (row.amount) {
            total += row.amount;
        }
    });

    frm.doc.items.forEach(row => {
        let packaging_per_item = (row.amount / total) * packaging_amount;
        frappe.model.set_value(row.doctype, row.name, "custom_packaging", packaging_per_item)
    })
    frm.refresh_field("items");
}

function development_amt_calculation(frm) {
    let development_amount = isNaN(frm.doc.custom_development) ? 0 : frm.doc.custom_development
    let total = 0;
    frm.doc.items.forEach(function (row) {
        if (row.amount) {
            total += row.amount;
        }
    });

    frm.doc.items.forEach(row => {
        let development_per_item = (row.amount / total) * development_amount;
        frappe.model.set_value(row.doctype, row.name, "custom_development", development_per_item)
    })
    frm.refresh_field("items");
}
function miscellaneous_amt_calculation(frm) {
    let miscellaneous_amount = isNaN(frm.doc.custom_miscellaneous) ? 0 : frm.doc.custom_miscellaneous
    let total = 0;
    frm.doc.items.forEach(function (row) {
        if (row.amount) {
            total += row.amount;
        }
    });

    frm.doc.items.forEach(row => {
        let miscellaneous_per_item = (row.amount / total) * miscellaneous_amount;
        frappe.model.set_value(row.doctype, row.name, "custom_miscellaneous", miscellaneous_per_item)
    })
    frm.refresh_field("items");
}
