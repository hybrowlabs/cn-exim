frappe.ui.form.on("Pre Alert", {
    pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_exchange_rate",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                var exchange_rate = r.message[0][0]['exchange_rate']
                var exchange = r.message[0][0]['currency']
                frm.set_value("currency", exchange)
                frm.set_value("exch_rate", exchange_rate)
                let total_inr_amount = frm.doc.total_doc_val * exchange_rate
                frm.set_value("total_inr_val", total_inr_amount)


                data = r.message[1]
                data.forEach(function (obj) {
                    var row = frm.add_child("item_details")
                    row.item_code = obj['item'];
                    row.quantity = obj['pick_qty']
                    row.description = obj['material_desc']
                    row.material_name = obj['material']
                    row.po_no = obj['po_number']
                    row.item_price = obj['rate']
                    row.amount = obj['amount']
                    row.item_price = obj['rate']
                    row.po_qty = obj['quantity']
                    row.total_inr_value = obj['amount'] * frm.doc.exch_rate
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Item",
                            filters: {
                                name: obj['item']
                            },
                            fields: ["name", "gst_hsn_code"]
                        },
                        callback: function (response) {
                            let hsnCode = response.message[0].gst_hsn_code;
                            row.hsn_code = hsnCode
                        }
                    })
                })
                frm.refresh_field("item_details")
            }
        })

        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_attachments",
            args: {
                name: frm.doc.pickup_request
            },
            callback: function (r) {
                let data = r.message
                data.forEach(function (obj) {
                    var row = frm.add_child("attach_document")
                    row.description = obj['description']
                    row.attach_xswj = obj['attach_xswj']
                })
                frm.refresh_field("attach_document")
            }
        })
    },
    before_save: function (frm) {
        freight_amt_calculation(frm)
        insurance_calculation(frm)
        other_charges_calculation(frm)
        calculation_tax(frm)
        total_calculations(frm)
        calculation_of_rodtep(frm)
        calculation_used_rodtep(frm)
    },
    insurance: function (frm) {
        // insurance_calculation(frm)
        if (frm.doc.insurance > 0) {
            // Calculate insurance amount from entered percentage
            let insurance_value = (frm.doc.total_inr_val * frm.doc.insurance) / 100;
            frm.set_value("insurance_amount", insurance_value);
            insurance_calculation(frm, insurance_value);
        }
    },
    insurance_amount: function (frm) {
        // insurance_calculation(frm)
        if (frm.doc.insurance_amount > 0) {
            // Calculate percentage from entered amount
            let insurance_percentage = (frm.doc.insurance_amount / frm.doc.total_inr_val) * 100;
            frm.set_value("insurance", insurance_percentage);
            insurance_calculation(frm, frm.doc.insurance_amount);
        }
    },
    freight_amt: function (frm) {
        freight_amt_calculation(frm)
    },
    ex_works: function (frm) {
        freight_amt_calculation(frm)
    },
    other_charges: function (frm) {
        other_charges_calculation(frm)
    },
    refresh: function (frm) {
        frm.add_custom_button("Calculate", function (obj) {
            freight_amt_calculation(frm)
            insurance_calculation(frm)
            other_charges_calculation(frm)
            calculation_tax(frm)
            total_calculations(frm)
            calculation_of_rodtep(frm)
        })
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Pre-Check List", function () {
                let items = [];

                // Loop through item_details and push data
                frm.doc.item_details.forEach(item => {
                    items.push({
                        'po_no': item.po_no,
                        'item_code': item.item_code,
                        'quantity': item.quantity,
                        "po_qty": item.po_qty,
                        'amount': item.amount,
                        'insurance_amount': item.insurance_amount,
                        'hsn_code': item.hsn_code,
                        'category': item.category,
                        'material_name': item.material_name,
                        'description': item.description,
                        'item_price': item.item_price,
                        'total_inr_value': item.total_inr_value,
                        'freight_amount': item.freight_amount,
                        'misc_charge_amt': item.misc_charge_amt,
                        'total_amount': item.total_amount,
                        'bcd_': item.bcd_,
                        'hcs_': item.hcs_,
                        'swl_': item.swl_,
                        'igst_': item.igst_,
                        'bcd_amount': item.bcd_amount,
                        'hcs_amount': item.hcs_amount,
                        'swl_amount': item.swl_amount,
                        'igst_amount': item.igst_amount
                    });
                });

                let rodteps = []
                frm.doc.rodtep_details.forEach(item => {
                    rodteps.push({
                        'script_no': item.script_no,
                        'amount': item.amount,
                        'script_date': item.script_date,
                        'used_rodtep': item.used_rodtep
                    })
                })

                // Instead of new_doc, use frappe.call to avoid redirection
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            'doctype': 'Pre-Alert Check List',
                            'pre_alert': frm.doc.name,
                            'pickup_request': frm.doc.pickup_request,
                            'rfq_number': frm.doc.rfq_number,
                            'vendor': frm.doc.vendor,
                            'currency': frm.doc.currency,
                            'total_doc_val': frm.doc.total_doc_val,
                            'total_inr_val': frm.doc.total_inr_val,
                            'exch_rate': frm.doc.exch_rate,
                            'freight_amt': frm.doc.freight_amt,
                            'ex_works': frm.doc.ex_works,
                            'other_charges': frm.doc.other_charges,
                            'insurance_amount': frm.doc.insurance_amount,
                            'insurance': frm.doc.insurance,
                            'accessible_val': frm.doc.accessible_val,
                            'house_number': frm.doc.house_number,
                            'master_number': frm.doc.master_number,
                            'invoice_no': frm.doc.invoice_no,
                            'invoice_dt': frm.doc.invoice_dt,
                            'eta': frm.doc.eta,
                            'etd': frm.doc.etd,
                            'invoice_details': frm.doc.invoice_details,
                            'cha': frm.doc.cha,
                            'courier': frm.doc.courier,
                            'payment_type': frm.doc.payment_type,
                            'iin_number': frm.doc.iin_number,
                            'rem_rodtep': frm.doc.rem_rodtep,
                            'tot_rodt_ut': frm.doc.tot_rodt_ut,
                            'rodtep_utilization': frm.doc.rodtep_utilization,
                            'file_attachments': frm.doc.file_attachments,
                            'igcr': frm.doc.igcr,
                            'bcd_amount': frm.doc.bcd_amount,
                            'h_cess_amount': frm.doc.h_cess_amount,
                            'sws_amount': frm.doc.sws_amount,
                            'igst_amount': frm.doc.igst_amount,
                            'total_freight': frm.doc.total_freight,
                            'total_duty': frm.doc.total_duty,
                            'remarks': frm.doc.remarks,
                            'item_details': items,
                            'rodtape_details': rodteps
                        }
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route("Form", "Pre-Alert Check List", r.message['name'])
                            frappe.show_alert({
                                message: __('Pre Alert Check List created successfully!'),
                                indicator: 'green'
                            }, 5);
                        } else {
                            frappe.msgprint('There was an error saving the Pre Alert Check List');
                            console.error('Error Saving Document:', r.exc);
                        }
                    }
                });
            }, __('Create'));
        }

        frm.set_query('cha', function () {
            return {
                filters: {
                    'supplier_group': "CHA"
                }
            }
        })

        frm.add_custom_button("Rodtep", function () {
            let d = new frappe.ui.form.MultiSelectDialog({
                doctype: "Rodtep Utilization",
                target: this.cur_frm,
                setters: {
                    script_date: null,
                    remaining_amount: null,
                },
                add_filters_group: 1,
                date_field: "script_date",
                columns: ["name", "script_date", "remaining_amount"],
                get_query() {
                    return {
                        filters: {
                            docstatus: ['!=', 2],
                            status: ['=', "Unuse"]
                        }
                    }
                },
                action: async function (selections) {
                    d.dialog.hide();
                    const promises = [];

                    selections.forEach(function (obj) {
                        let is_duplicate = false;

                        $.each(frm.doc.rodtep_details || [], function (i, d) {
                            if (obj === d.script_no) {
                                is_duplicate = true;
                                return false;
                            }
                        });

                        if (!is_duplicate) {
                            promises.push(
                                frappe.call({
                                    method: "frappe.client.get_list",
                                    args: {
                                        doctype: "Rodtep Utilization",
                                        filters: {
                                            name: obj,
                                        },
                                        fields: ["name", "amount", "remaining_amount", "script_date"],
                                    },
                                    callback: function (r) {
                                        if (r.message && r.message.length > 0) {
                                            let row = frm.add_child("rodtep_details");
                                            row.script_no = obj;
                                            row.amount = r.message[0]["remaining_amount"];
                                            row.script_date = r.message[0]["script_date"];
                                            frm.refresh_field("rodtep_details");
                                        }
                                    }
                                })
                            );
                        }
                    });

                    await Promise.all(promises);
                    calculation_of_rodtep(frm)
                }
            })
            d.dialog.show()

        }, __("Get Details"));





        //  this code to add the comment in the pre alert form on reject any hod throw.
        let crm_notes = `
                <div class="notes-section col-xs-12">
                    <div class="all-notes" id="all_notes_section">
                        <!-- Existing notes will be displayed here -->
                    </div>
                </div>
                <style>
                    .comment-content {
                        border: 1px solid var(--border-color);
                        border-radius: 5px;
                        padding: 8px;
                        background: #f8f9fa;
                        margin-bottom: 8px;
                    }
                    .comment-content table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .comment-content td {
                        padding: 8px;
                    }
                    .comment-content th {
                        font-weight: bold;
                        text-align: left;
                        padding: 8px;
                    }
                    .no-activity {
                        text-align: center;
                        color: #888;
                        padding: 10px;
                    }
                </style>`;

        frm.get_field("custom_notes_html").wrapper.innerHTML = crm_notes;

        let allNotesSection = document.getElementById("all_notes_section");

        if (!allNotesSection) {
            console.error("all_notes_section not found!");
            return;
        }

        if (frm.doc.custom_crm_note && frm.doc.custom_crm_note.length > 0) {
            let tableHTML = `
                    <div class="comment-content">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:30%">Added By</th>
                                    <th style="width:40%">Note</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                        </table>
                    </div>`;

            frm.doc.custom_crm_note.forEach((note) => {
                tableHTML += `
                    <div class="comment-content">
                        <table>
                            <tr>
                                <td style="width:30%">${note.added_by}</td>
                                <td style="width:40%">${note.note}</td>
                                <td>${frappe.datetime.global_date_format(note.added_on)}</td>
                            </tr>
                        </table>
                    </div>`;
            });

            allNotesSection.innerHTML = tableHTML;
        } else {
            allNotesSection.innerHTML = `<p class="no-activity">No Notes Available</p>`;
        }
    },
    total_doc_val: function (frm) {
        var total_inr = frm.doc.exch_rate * frm.doc.total_doc_val
        frm.set_value("total_inr_val", total_inr)
    },
    igcr: function (frm) {
        if (frm.doc.igcr == 1) {
            $.each(frm.doc.item_details || [], function (i, d) {
                d.igcr = 1
                d.category = 9
                let hsn_code = d.hsn_code
                let category = d.category
                get_percentage_of_hsn_and_category_base(frm, d, hsn_code, category)
            })
            frm.refresh_field("item_details")
        }
    },
    on_submit: function (frm) {
        update_rodtep_base_on_used(frm)
        // send_email_to_cha(frm)
    },
});

frappe.ui.form.on("Pre-Alert Item Details", {
    category: function (frm, cdt, cdn) {
        var row = locals[cdt][cdn]
        let hsn_code = row.hsn_code
        let category = row.category
        get_percentage_of_hsn_and_category_base(frm, row, hsn_code, category)
    }
})

function get_percentage_of_hsn_and_category_base(frm, row_or_d, hsn_code, category) {
    if (hsn_code != undefined && category != undefined) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args: {
                name: hsn_code,
                category: category
            },
            callback: function (response) {
                var data = response.message
                data.forEach(function (obj) {
                    row_or_d.bcd_ = obj['bcd']
                    row_or_d.hcs_ = obj['hcs']
                    row_or_d.swl_ = obj['swl']
                    row_or_d.igst_ = obj['igst']
                })
                calculation_tax(frm)
                total_calculations(frm)
                frm.refresh_field("item_details")
            }
        })
    }
}


function freight_amt_calculation(frm) {
    let total_value = 0;
    let freight_amt = isNaN(frm.doc.freight_amt) || frm.doc.freight_amt == null ? 0 : frm.doc.freight_amt;
    let ex_work = isNaN(frm.doc.ex_works) || frm.doc.ex_works == null ? 0 : frm.doc.ex_works;
    let total_charge = freight_amt + ex_work

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * total_charge;
        frappe.model.set_value(item.doctype, item.name, 'freight_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });

    frm.refresh_field('item_details');
}

function insurance_calculation(frm, insurance_value) {
    let total_value = 0;

    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });

    frm.doc.item_details.forEach(item => {
        let item_charge = (item.total_inr_value / total_value) * insurance_value;
        frappe.model.set_value(item.doctype, item.name, 'insurance_amount', item_charge);
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);

    });
    frm.refresh_field('item_details');
}

function other_charges_calculation(frm) {
    let total_value = 0
    let other_charges = frm.doc.other_charges
    frm.doc.item_details.forEach(item => {
        total_value += item.total_inr_value;
    });
    frm.doc.item_details.forEach(item => {
        let misc_charge_amt = (item.total_inr_value / total_value) * other_charges
        if (isNaN(misc_charge_amt)) {
            misc_charge_amt = 0;
        }
        frappe.model.set_value(item.doctype, item.name, "misc_charge_amt", misc_charge_amt)
        let total_inr_value = isNaN(item.total_inr_value) || item.total_inr_value == null ? 0 : item.total_inr_value;
        let freight_amount = isNaN(item.freight_amount) || item.freight_amount == null ? 0 : item.freight_amount;
        let insurance_amount = isNaN(item.insurance_amount) || item.insurance_amount == null ? 0 : item.insurance_amount;
        let misc_charge_amt1 = isNaN(item.misc_charge_amt) || item.misc_charge_amt == null ? 0 : item.misc_charge_amt;

        let total_amount = total_inr_value + freight_amount + insurance_amount + misc_charge_amt1;

        frappe.model.set_value(item.doctype, item.name, 'total_amount', total_amount);
    })
}

function calculation_tax(frm) {
    frm.doc.item_details.forEach(item => {
        var bcd_amount = (item.bcd_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'bcd_amount', bcd_amount)
        var hcs_amount = (item.hcs_ * item.total_amount) / 100
        frappe.model.set_value(item.doctype, item.name, 'hcs_amount', hcs_amount)

        var swl_total = bcd_amount + hcs_amount
        var swl_amount = (item.swl_ * swl_total) / 100
        frappe.model.set_value(item.doctype, item.name, 'swl_amount', swl_amount)

        var total_duty = bcd_amount + hcs_amount + swl_amount + item.total_amount
        frappe.model.set_value(item.doctype, item.name, 'total_duty', total_duty)

        var igst_amount = (item.igst_ * total_duty) / 100
        frappe.model.set_value(item.doctype, item.name, 'igst_amount', igst_amount)

        let final_duty = item.total_duty_forgone + item.hcs_amount + item.swl_amount + item.igst_amount

        frappe.model.set_value(item.doctype, item.name, "final_total_duty", final_duty)

        var total = item.freight_amount + item.insurance_amount + item.bcd_amount + item.hcs_amount + item.swl_amount + item.igst_amount
        frappe.model.set_value(item.doctype, item.name, 'total', total)
    })
    frm.refresh_field('item_details');
}

function total_calculations(frm) {
    let accessible_val = frm.doc.total_inr_val + frm.doc.freight_amt + frm.doc.ex_works + frm.doc.insurance_amount
    frm.set_value("accessible_val", accessible_val)

    let total_bcd_amount = 0
    let total_h_cess_amount = 0
    let total_sws_amount = 0
    let total_igst_amount = 0
    let total_freight_amount = 0
    let total_duty = 0

    frm.doc.item_details.forEach(item => {
        total_bcd_amount += item.bcd_amount
        total_h_cess_amount += item.hcs_amount
        total_sws_amount += item.swl_amount
        total_igst_amount += item.igst_amount
        total_freight_amount += item.freight_amount
        total_duty += item.final_total_duty
    })

    frm.set_value("bcd_amount", total_bcd_amount)
    frm.set_value("h_cess_amount", total_h_cess_amount)
    frm.set_value("sws_amount", total_sws_amount)
    frm.set_value("igst_amount", total_igst_amount)
    frm.set_value("total_freight", total_freight_amount)
    frm.set_value("total_duty", total_duty)

    frappe.show_alert({
        message: __('Hi, Calculation Completed'),
        indicator: 'green'
    }, 5);

}



function calculation_of_rodtep(frm) {
    let rodtep_total = 0;
    $.each(frm.doc.rodtep_details || [], function (i, d) {
        rodtep_total += d.amount;
    });

    frm.set_value("rem_rodtep", rodtep_total);

    let total_rodtep_utilization = 0
    $.each(frm.doc.item_details || [], function (i, d) {
        if (rodtep_total > 0) {

            let remaining = rodtep_total - d.bcd_amount;

            d.rodtep_utilization = d.bcd_amount;
            if (remaining < 0) {
                d.total_duty_forgone = Math.abs(remaining);
                rodtep_total = 0;
            } else {
                d.total_duty_forgone = 0;
                rodtep_total = remaining;
            }
        } else {
            d.rodtep_utilization = 0;
            d.total_duty_forgone = d.bcd_amount || 0;
        }
        if (d.bcd_amount != d.total_duty_forgone) {
            total_rodtep_utilization += d.bcd_amount
            total_rodtep_utilization -= d.total_duty_forgone
        }
    });
    frm.set_value("tot_rodt_ut", total_rodtep_utilization)
    frm.refresh_field("item_details");
}

function calculation_used_rodtep(frm) {
    var total_rodtep_used = frm.doc.tot_rodt_ut;

    $.each(frm.doc.rodtep_details || [], function (i, d) {
        if (total_rodtep_used >= d.amount) {
            d.used_rodtep = d.amount;
            total_rodtep_used -= d.amount;
        } else {
            d.used_rodtep = total_rodtep_used;
            total_rodtep_used = 0;
        }
    });
    frm.refresh_field("rodtep_details");

}

function update_rodtep_base_on_used(frm) {
    $.each(frm.doc.rodtep_details || [], function (i, d) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.update_rodtep",
            args: {
                name: d.script_no,
                use_rodtep: d.used_rodtep
            }
        })
    })
}

function send_email_to_cha(frm) {
    frappe.call({
        method: "cn_exim.cn_exim.doctype.pre_alert.pre_alert.send_mail_to_cha",
        args: {
            sender: frappe.session.user,
            cha_name: frm.doc.cha,
            doc_name: frm.doc.name
        },
        callback: function (r) {
            frappe.show_alert({
                message: __('Email Is Sent For Cha'),
                indicator: 'green'
            }, 5)
        }
    })
}

// comment table in comments tab section
frappe.ui.form.on('Pre Alert', {
    refresh: function (frm) {
        let crm_notes = `
            <div class="notes-section col-xs-12">
                <div class="all-notes" id="all_notes_section">
                    <!-- Existing notes will be displayed here -->
                </div>
            </div>
            <style>
                .comment-content {
                    border: 1px solid var(--border-color);
                    border-radius: 5px;
                    padding: 8px;
                    background: #f8f9fa;
                    margin-bottom: 8px;
                }
                .comment-content table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .comment-content td {
                    padding: 8px;
                }
                .comment-content th {
                    font-weight: bold;
                    text-align: left;
                    padding: 8px;
                }
                .no-activity {
                    text-align: center;
                    color: #888;
                    padding: 10px;
                }
            </style>`;

        frm.get_field("custom_notes_html").wrapper.innerHTML = crm_notes;

        let allNotesSection = document.getElementById("all_notes_section");

        if (!allNotesSection) {
            console.error("all_notes_section not found!");
            return;
        }

        if (frm.doc.custom_crm_note && frm.doc.custom_crm_note.length > 0) {
            let tableHTML = `
                <div class="comment-content">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:30%">Added By</th>
                                <th style="width:40%">Reason</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                    </table>
                </div>`;

            frm.doc.custom_crm_note.forEach((note) => {
                tableHTML += `
                <div class="comment-content">
                    <table>
                        <tr>
                            <td style="width:30%">${note.added_by}</td>
                            <td style="width:40%">${note.note}</td>
                            <td>${frappe.datetime.global_date_format(note.added_on)}</td>
                        </tr>
                    </table>
                </div>`;
            });

            allNotesSection.innerHTML = tableHTML;
        } else {
            allNotesSection.innerHTML = `<p class="no-activity">No Notes Available</p>`;
        }
    }
});