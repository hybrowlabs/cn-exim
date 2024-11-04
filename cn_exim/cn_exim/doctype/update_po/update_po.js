frappe.ui.form.on("Update Po", {
    pre_alert_request(frm, cdt, cdn) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.update_po.update_po.get_items_details_form_pre_alert",
            args: {
                name: frm.doc.pre_alert_request
            },
            callback: function (response) {
                var items_data = response.message

                frm.clear_table("update_po_details");
                items_data.forEach(function (obj) {
                    var row = frm.add_child("update_po_details")
                    row.purchase_order = obj.po_no
                    row.item_code = obj.item_code
                    row.item_name = obj.material_name
                    row.order_quantity = obj.quantity
                    row.total_inr_value = obj.total_inr_value
                })
                frm.refresh_field("update_po_details")
            }
        })
    },
    before_save: function (frm) {
        var total_charges = 0
        frm.doc.update_po_details.forEach(items => {
            total_charges += items.total_charges_of_types
        })
        frm.set_value("total_category_charges", total_charges)
    },
    refresh: function (frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Purchase Receipt", function () {
                let items_details = [];
                let promises = [];

                frm.doc.update_po_details.forEach(item => {
                    let promise = new Promise((resolve, reject) => {
                        frappe.call({
                            method: "cn_exim.cn_exim.doctype.update_po.update_po.get_po_details",
                            args: {
                                po_no: item.purchase_order,
                                item_code: item.item_code
                            },
                            callback: function (r) {
                                let data = r.message;
                                data.forEach(function (obj) {
                                    items_details.push({
                                        'item_code': item.item_code,
                                        'item_name': item.item_name,
                                        'qty': item.order_quantity,
                                        'rate': obj.rate,
                                        'base_rate': obj.base_rate,
                                        'purchase_order_item': obj.name,
                                        'purchase_order': item.purchase_order,
                                        'base_amount': item.total_inr_value,
                                    });
                                });
                                resolve();
                            },
                            error: function (err) {
                                reject(err);
                            }
                        });
                    });
                    promises.push(promise);
                });

                // Wait for all promises to resolve before proceeding
                Promise.all(promises).then(() => {
                    frappe.call({
                        method: "frappe.client.insert",
                        args: {
                            doc: {
                                'doctype': "Purchase Receipt",
                                'supplier': frm.doc.vendor,
                                'currency': frm.doc.currency,
                                'items': items_details,
                                'custom_pre_alert_request': frm.doc.pre_alert_request,  
                                'custom_pickup_request': frm.doc.pickup_request,
                                'custom_rfq_no': frm.doc.rfq_no,
                                'custom_house_number': frm.doc.house_number,
                                'custom_master_number': frm.doc.master_number,
                                'custom_bcd_amount': frm.doc.bcd_amount,
                                'custom_hcs_amount': frm.doc.hcs_amount,
                                'custom_sws_amount': frm.doc.sws_amount,
                                'custom_igst_amount': frm.doc.igst_amount,
                                'custom_total_duty': frm.doc.total_duty,
                                'custom_freight_amount': frm.doc.freight_amount,
                                'custom_exworks': frm.doc.ex_works,
                                'custom_other_charges': frm.doc.other_charges,
                                'custom_insurance_amount': frm.doc.insurance_amount,
                                'custom_insurance_': frm.doc.insurance_,
                                'custom_cha_agenncy_charges': frm.doc.cha_agenncy_charges,
                                'custom_cha_clearing_charges' : frm.doc.cha_clearing_charges,
                                'custom_local_transporter_charges': frm.doc.local_transporter_charges,
                                'custom_local_freight_vendor_charges': frm.doc.local_freight_vendor_charges,
                                'custom_freight_and_forwarding_vendor_charges': frm.doc.freight_and_forwarding_vendor_charges,
                                'custom_update_po_number':frm.doc.name,
                                'custom_total_charges':frm.doc.bcd_amount + frm.doc.hcs_amount + frm.doc.sws_amount + frm.doc.ex_works + frm.doc.other_charges + frm.doc.insurance_amount + frm.doc.cha_agenncy_charges + frm.doc.cha_clearing_charges + frm.doc.local_transporter_charges + frm.doc.local_freight_vendor_charges + frm.doc.freight_and_forwarding_vendor_charges,
                                'custom_total_category_charges':frm.doc.total_category_charges
                            }
                        },
                        callback: function (r) {
                            if (!r.exc) {
                                frappe.show_alert({
                                    message: __('Purchase Receipt created successfully!'),
                                    indicator: 'green'
                                }, 5);
                            } else {
                                frappe.msgprint('There was an error saving the Purchase Receipt');
                                console.error('Error Saving Document:', r.exc);
                            }
                        }
                    });
                }).catch(err => {
                    frappe.msgprint('There was an error fetching purchase order details');
                    console.error('Error fetching purchase order details:', err);
                });
            }, __("Create"));
        }
    }
});

frappe.ui.form.on('Update Po Details', {
    form_render: function (frm, cdt, cdn) {
        var category_type_list = [];

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Import Charges Type",
            },
            callback: function (response) {
                var data = response.message;
                data.forEach(function (obj) {
                    category_type_list.push(obj.name);
                });

                updateChargesHtml(frm, cdt, cdn, category_type_list);
            }
        });
    }
});

function updateChargesHtml(frm, cdt, cdn, category_type_list) {
    var d = locals[cdt][cdn];

    // Reference the child row's HTML field
    let wrapper = frm.fields_dict['update_po_details'].grid.grid_rows_by_docname[cdn].grid_form.fields_dict['charges_html'];

    let html = `
        <style>
            .wide-table {
                width: 100%; 
            }
            .charges_type {
                width: 60%; 
            }
            .text-right {
                text-align: right;
            }
        </style>

        <div class="container mt-3">
            <table class="table table-bordered table-hover wide-table" id="charges-table">
                <thead class="thead-light">
                    <tr>
                        <th scope="col" class="charges_type">Charges Type</th>
                        <th scope="col" class="text-right">Percentage</th>
                        <th scope="col" class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Dynamic rows will be added here -->
                </tbody>
            </table>
            <button id="add-row-btn" class="btn btn-primary">Add Row</button>
        </div>
    `;

    // Render the initial HTML table
    $(wrapper.wrapper).html(html);

    // Display stored data in the HTML table
    displayStoredData(frm, d.name);

    // Add row on button click
    $(wrapper.wrapper).find('#add-row-btn').click(function () {
        addRow(category_type_list, d.total_inr_value);
    });

    // Function to display stored data in the HTML table with editable fields
    function displayStoredData(frm, row_name) {
        frm.doc.category_type_stoer_data.forEach(function (data_row) {
            if (data_row.po_update_details_name === row_name) {
                let optionsHtml = '<option value=""></option>';

                category_type_list.forEach(function (type) {
                    optionsHtml += `<option value="${type}" ${data_row.charges_type === type ? 'selected' : ''}>${type}</option>`;
                });

                let newRow = `
                    <tr>
                        <td>
                            <select class="form-control charges-type-select" name="charges_type">
                                ${optionsHtml}
                            </select>
                        </td>
                        <td><input type="number" step="0.01" class="form-control text-right percentage-input" name="percentage" value="${data_row.percentage || ''}"></td>
                        <td><input type="number" step="0.01" class="form-control text-right amount-input" name="amount" value="${data_row.amount || ''}" readonly></td>
                    </tr>
                `;
                $(wrapper.wrapper).find('#charges-table tbody').append(newRow);

                // Calculate amount when percentage is changed
                $(wrapper.wrapper).find('.percentage-input:last').on('change', function () {
                    let percentage = parseFloat($(this).val());
                    if (!isNaN(percentage)) {
                        let calculatedAmount = (d.total_inr_value * percentage) / 100;
                        $(this).closest('tr').find('input[name="amount"]').val(calculatedAmount.toFixed(2));

                        showCurrentAndAllPreviousRowData();
                    }
                });
            }
        });
    }

    // Function to add a new row in the HTML table
    function addRow(category_type_list, total_inr_value) {
        let optionsHtml = '<option value=""></option>';

        category_type_list.forEach(function (type) {
            optionsHtml += `<option value="${type}">${type}</option>`;
        });

        let newRow = `
            <tr>
                <td>
                    <select class="form-control charges-type-select" name="charges_type">
                        ${optionsHtml}
                    </select>
                </td>
                <td><input type="number" step="0.01" class="form-control text-right percentage-input" name="percentage"></td>
                <td><input type="number" step="0.01" class="form-control text-right amount-input" name="amount" readonly></td>
            </tr>
        `;

        $(wrapper.wrapper).find('#charges-table tbody').append(newRow);

        // Calculate the amount based on the percentage entered
        $(wrapper.wrapper).find('.percentage-input:last').on('change', function () {
            let percentage = parseFloat($(this).val());
            if (!isNaN(percentage)) {
                let calculatedAmount = (total_inr_value * percentage) / 100;
                $(this).closest('tr').find('input[name="amount"]').val(calculatedAmount.toFixed(2));

                showCurrentAndAllPreviousRowData();
                updateTotalCharges(frm, cdt, cdn);
            }
        });
    }

    // Function to collect and store current row data into the Frappe child table
    function showCurrentAndAllPreviousRowData() {
        let currentRow = $(wrapper.wrapper).find('#charges-table tbody tr').last();
        let chargesTypeCurrent = $(currentRow).find('select[name="charges_type"]').val();
        let percentageCurrent = $(currentRow).find('input[name="percentage"]').val();
        let amountCurrent = $(currentRow).find('input[name="amount"]').val();

        let dictionary = {
            charge_type: chargesTypeCurrent,
            percentage: percentageCurrent,
            amount: amountCurrent,
            name: d.name
        };

        // Store the data into the linked Frappe field
        store_category_data(frm, dictionary);
    }

    function updateTotalCharges(frm, cdt, cdn) {
        // Sum all amounts in the HTML table
        let totalCharges = 0;
        $(wrapper.wrapper).find('#charges-table tbody tr').each(function () {
            let amount = parseFloat($(this).find('input[name="amount"]').val()) || 0;
            totalCharges += amount;
        });

        // Update the total_charges_of_types field in the child table
        frappe.model.set_value(cdt, cdn, 'total_charges_of_types', totalCharges.toFixed(2));
    }
}

// Function to store the category data into Frappe's child table
function store_category_data(frm, data) {
    if (data.charge_type != undefined) {
        var add_row = frm.add_child("category_type_stoer_data");
        add_row.charges_type = data.charge_type;
        add_row.amount = data.amount;
        add_row.percentage = data.percentage;
        add_row.po_update_details_name = data.name;
        frm.refresh_field("category_type_stoer_data");
    }
}
