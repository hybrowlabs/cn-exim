// Copyright (c) 2025, goblin and contributors
// For license information, please see license.txt
// const formOptions = {
//     baseUrl: window?.location?.origin || '',
//     fileService: {
//         uploadFile: (type, file) => {
//
//             return new Promise((resolve, reject) => {
//                 const formData = new FormData();
//                 formData.append('file', file);
//                 //   formData.append('fileName', fileName);
//                 //   formData.append('doctype', 'YourDoctype'); // Adjust this based on Frappe's needs
//                 //   formData.append('docname', 'YourDocname'); // Adjust this based on Frappe's needs
//
//                 const csrfToken = frappe.csrf_token; // Get CSRF token from cookies
//
//                 fetch(window?.location?.origin + '/api/method/upload_file', {
//                     method: 'POST',
//                     headers: {
//                         'X-Frappe-CSRF-Token': csrfToken, // Include the CSRF token in the request headers
//                         'Accept': 'application/json',
//                     },
//                     body: formData,
//                 })
//                     .then(response => response.json())
//                     .then(result => {
//                         if (result.error) {
//                             reject(result.error);
//                         } else {
//                             frappe.call({
//                                 method: "chatnext_manufacturing.utils.get_excel_data",
//                                 args: {
//                                     doc: result.message
//                                 },
//                                 callback: function (r) {
//                                     if (!r.exc) {
//                                         window.cur_formioInstance.emit('fileupload', {
//                                             detail: {data: r.message} // Optional, you can pass any data in 'detail'
//                                         });
//                                     } else {
//                                         console.log(r.message)
//                                     }
//                                 }
//                             })
//
//                             resolve({
//                                 storage: 'url',
//                                 url: result.message.file_url, // URL where the file is stored in Frappe
//                                 size: file.size,
//                                 type: file.type,
//                                 data: result,
//                             });
//                         }
//                     })
//                     .catch(error => {
//                         reject(error);
//                     });
//             });
//         },
//     },
// };

frappe.ui.form.on("Item Attributes Template", {
    refresh(frm) {
      console.log("working or not");
      const wrapper = frm.fields_dict.form_builder.$wrapper;
      wrapper.html("");
      const formBuilder = document.createElement("custom-form-builder");
  
      const wrapper_1 = frm.fields_dict.form_preview.$wrapper;
      const form = document.createElement("div");
      wrapper_1.html("");
      wrapper_1.append(form);
      const f = window.Formio.createForm(
        form,
        JSON.parse(frm.doc.custom_form_data || "{}"),
        {},
      ).then((form) => {
        window.cur_formioInstance = form;
        form.on("change", ({ data }) => {
          console.log({ data });
          cur_frm.set_value("sample_form_data", JSON.stringify(data, null, 2));
        });
      });
  
      f.then(() => {
        window.cur_formioInstance.triggerChange();
      });
  
      wrapper.append(formBuilder);
    },
  });
  