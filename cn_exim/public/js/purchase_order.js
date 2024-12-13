frappe.ui.form.on("Purchase Order", {
    refresh: function (frm) {
        if (frm.doc.custom_purchase_type == "Import" && frm.doc.docstatus == 1) {
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
                        'amount_in_inr': element.base_amount
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
    }
})


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