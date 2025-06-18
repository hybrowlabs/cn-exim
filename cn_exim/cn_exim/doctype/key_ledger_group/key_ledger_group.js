// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Key Ledger Group", {
	onload: function (frm) {
        frm.fields_dict["key_ledger_group_details"].grid.get_field("default_inventory_account").get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0,
                    account_type: "Stock"
                }
            };
        };

        frm.fields_dict["key_ledger_group_details"].grid.get_field("stock_received_but_not_billed").get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0,
                    root_type: "Liability",
                    account_type: "Stock Received But Not Billed"
                }
            };
        };

        frm.fields_dict['key_ledger_group_details'].grid.get_field('default_expense_account').get_query = function (doc, cdt, cdn) {
            let row = locals[cdt][cdn];
            return {
                filters: {
                    company: row.company,
                    is_group: 0
                }
            };
        }
    },
});
