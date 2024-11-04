frappe.ui.form.on("Request for Quotation", {
    custom_shipment_address: function (frm) {
        erpnext.utils.get_address_display(frm, "custom_shipment_address", "custom_shipment_address_details", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    custom_currency_name:function(frm){
        frappe.call({
            method:"erpnext.setup.utils.get_exchange_rate",
            args:{
                from_currency: frm.doc.custom_currency_name,
                to_currency:"INR",
                transaction_date: frappe.datetime.get_today()
            },
            callback:function(r){
                frm.set_value("custom_currency", r.message)
            }
        })
    },
    custom_pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.api.get_api_list",
            args: {
                pr: frm.doc.custom_pickup_request
            },
            callback: function (r) {
                
                var data = r.message[2]
                data.forEach(function(obj){
                    var row = frm.add_child("custom_purchase_order")
                    row.purchase_order = obj.po_number
                })
                frm.refresh_field("custom_purchase_order")
            }
        })
    },
    custom_select_service: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.api.supplier_quotation",
            args: {
                service: frm.doc.custom_select_service
            },
            callback: function (r) {

                if (r.message) {
                    frm.set_query('supplier', 'suppliers', (doc, cdt, cdn) => {
                        return {
                            filters: [
                                ['Supplier', 'name', 'in', r.message]
                            ]
                        };
                    })
                }
            }
        })
    },
    refresh: function (frm) {

        function remove_custom_button(label, group) {
            if (group) {
                frm.page.remove_inner_button(label, group);
            } else {
                frm.page.remove_inner_button(label);
            }
        }

        remove_custom_button('Supplier Quotation', 'Create');

        frm.add_custom_button("Supplier Quotations", function () {
            let items_details = []
            frm.doc.items.forEach(item => {
                items_details.push({
                    'item_code': item.item_code,
                    'item_name': item.item_name,
                    'description': item.description,
                    'qty': item.qty,
                    'uom': item.uom,
                    'expected_delivery_date': item.schedule_date,
                    'request_for_quotation': frm.doc.name,

                })
            })

            frm.doc.suppliers.forEach(item => {
                frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: {
                            'doctype': "Supplier Quotation",
                            'supplier': item.supplier,
                            'custom_type': frm.doc.custom_type,
                            'custom_pickup_request': frm.doc.custom_pickup_request,
                            'valid_till': frm.doc.schedule_date,
                            'custom_shipment_mode': frm.doc.custom_mode_of_shipment,
                            'custom_shipment_type': frm.doc.custom_shipment_type,
                            'custom_port_of_loading': frm.doc.custom_port_of_loading,
                            'custom_country': frm.doc.custom_country,
                            'custom_port_code': frm.doc.custom_port_code,
                            'custom_package_type': frm.doc.custom_package_type,
                            'custom_eda': frm.doc.custom_eda,
                            'custom_no_of_pkg_unit': frm.doc.custom_no_of_pkg_units,
                            'custom_shipment_date': frm.doc.custom_shipment_date,
                            'custom_port_of_destination': frm.doc.custom_port_of_destination,
                            'custom_actual_weight': frm.doc.custom_actual_weights,
                            'custom_product_category': frm.doc.custom_product_category,
                            'custom_vol_weightkg': frm.doc.custom_vol_weight,
                            'custom_remarks': frm.doc.custom_remarks,
                            'items': items_details,
                            'incoterm': frm.doc.custom_inco_terms,
                        },
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.show_alert({
                                message: __('Pre Supplier Quotation created successfully!'),
                                indicator: 'green'
                            }, 5);
                        } else {
                            frappe.msgprint('There was an error saving the Pre Alert Check List');
                            console.error('Error Saving Document:', r.exc);
                        }
                    }
                })
            })
        }, ("Create"))
    }
})