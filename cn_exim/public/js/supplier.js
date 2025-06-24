frappe.ui.form.on("Supplier",{
    supplier_group:function(frm){
        if(frm.doc.supplier_group == "Domestic Material"){
            frm.set_value("naming_series", "DM.#######")
        }
        else if(frm.doc.supplier_group == "Domestic Service"){
            frm.set_value("naming_series", "DS.#######")
        }
        else if(frm.doc.supplier_group == "Import Material"){
            frm.set_value("naming_series", "IM.#######")
        }
        else if(frm.doc.supplier_group == "Import Service"){
            frm.set_value("naming_series", "IS.#######")
        }
        else if(frm.doc.supplier_group == "Employee"){
            frm.set_value("naming_series", "DM.#######")
            frm.set_value("is_internal_supplier", 1)
        }
    },

    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('Bulk Contact'), function() {
                bulk_contact(frm);
            }, __('Create'));


            frm.set_df_property("default_price_list", "hidden", 0);
            frm.refresh_field("default_price_list");
        }

        else{
            frm.set_df_property("default_price_list", "hidden", 1);
        }

        if (!frm.doc.supplier_primary_contact) {
            frappe.call({
                method: "cn_exim.overrides.supplier.get_primary_contact_raw",
                args: {
                    supplier: frm.doc.name
                },
                callback: function (r) {
                    if (r.message && r.message.length > 0) {
                        frm.set_value("supplier_primary_contact", r.message[0].name);
                        frm.save()
                    }
                    else{
                        frm.set_value("supplier_primary_contact", r.message[0].name);

                    }
                }
            });
        }

        if (!frm.doc.supplier_primary_address) {
            frappe.call({
                method: "cn_exim.overrides.supplier.get_primary_address_raw",
                args: {
                    supplier: frm.doc.name
                },
                callback: function (r) {
                    if (r.message && r.message.length > 0) {
                        frm.set_value("supplier_primary_address", r.message[0].name);
                        frm.save()
                    }
                    else{
                        frm.set_value("supplier_primary_address", r.message[0].name);

                    }
                }
            });
        }
        
    },
    onload:function(frm){
        setTimeout(() => {
            $("button:contains('New Contact')").hide();
        }, 500);
    }
})






function bulk_contact(frm) {
    const dialog = new frappe.ui.Dialog({
        title: 'Add Bulk Contacts',
        size: 'large',
        fields: [
            {
                fieldname: 'contacts',
                fieldtype: 'Table',
                label: 'Contacts',
                cannot_add_rows: false,
                in_place_edit: true,
                reqd: 1,
                fields: [
                    { fieldname: 'full_name', fieldtype: 'Data', label: 'Full Name', in_list_view: 1 },
                    { fieldname: 'email', fieldtype: 'Data', label: 'Email', options: 'Email', in_list_view: 1 },
                    { fieldname: 'mobile_no', fieldtype: 'Int', label: 'Mobile No.', in_list_view: 1 },
                    { fieldname: 'designation', fieldtype: 'Data', label: 'Designation', in_list_view: 1 }
                ]
            }
        ],
        primary_action_label: 'Create Contacts',
        primary_action(values) {
            if (values.contacts && values.contacts.length > 0) {
                dialog.hide();
                frappe.call({
                    method: "cn_exim.overrides.supplier.create_contact",
                    args: {
                        contacts: values.contacts,
                        supplier: frm.doc.name
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: __(r.message.created + " contact(s) created successfully."),
                                indicator: 'green'
                            });
                            frm.reload_doc();
                        }
                    }
                });
            } else {
                frappe.msgprint(__('Please add at least one contact.'));
            }
        }
    });

    dialog.show();
}


