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
            $.each(frm.doc.items || [], function (i, d) {
                if (frm.doc.payment_terms_template == undefined && d.purchase_order != undefined) {
                    frappe.call({
                        method: "cn_exim.config.py.purchase_invoice.get_payment_trams",
                        args: {
                            name: d.purchase_order
                        },
                        callback: function (response) {
                            let data = response.message[0]

                            frm.set_value("payment_terms_template", data['payment_terms_template'])
                        }
                    })
                }
            })
        }
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
