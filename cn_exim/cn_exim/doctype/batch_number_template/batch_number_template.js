// Copyright (c) 2024, goblin and contributors
// For license information, please see license.txt

frappe.ui.form.on("Batch Number Template", {
	refresh(frm) {
        frm.call("get_autocompletion_items")
		.then((r) => r.message)
		.then((items) => {
			frm.set_df_property("batch_number_logic", "autocompletions", items);
		});   
	},
});
