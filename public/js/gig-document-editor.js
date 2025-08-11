// Shared TinyMCE editor functionality for gig documents
class GigDocumentEditor {
  constructor(editorId, options = {}) {
    this.editorId = editorId;
    this.options = options;
    this.editor = null;
    this.init();
  }

  init() {
    // Initialize TinyMCE editor
    tinymce.init({
      selector: `#${this.editorId}`,
      height: 400,
      plugins: "table lists link lineheight",
      toolbar:
        "undo redo | formatselect fontsize fontfamily | indent outdent | bold italic underline strikethrough | forecolor backcolor | lineheight | alignleft aligncenter alignright | bullist numlist | link table | removeformat",
      line_height_formats:
        "0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1 1.2 1.4 1.6 1.8 2 2.5 3",
      extended_valid_elements: "span[style]",
      custom_elements: "~span",
      menubar: false,
      font_size_formats:
        "5px 6px 7px 8px 9px 10px 11px 12px 13px 14px 15px 16px 17px 18px 19px 20px 21px 22px 23px 24px",
      font_family_formats:
        "Andale Mono=andale mono,times; Arial=arial,helvetica,sans-serif; Arial Black=arial black,avant garde; Book Antiqua=book antiqua,palatino; Comic Sans MS=comic sans ms,sans-serif; Courier New=courier new,courier; Georgia=georgia,palatino; Helvetica=helvetica; Impact=impact,chicago; Symbol=symbol; Tahoma=tahoma,arial,helvetica,sans-serif; Terminal=terminal,monaco; Times New Roman=times new roman,times; Trebuchet MS=trebuchet ms,geneva; Verdana=verdana,geneva; Webdings=webdings; Wingdings=wingdings,zapf dingbats",
      content_style: `
                body { 
                    font-family: Arial, Helvetica, sans-serif !important; 
                    font-size: 14px !important; 
                    font-weight: 500 !important; 
                    /* Allow line-height to be controlled by editor options */
                }
                p { 
                    margin: 0.2em 0 !important; 
                    font-weight: 500 !important;
                }
                p:empty { 
                    margin: 0.1em 0 !important; 
                    height: 0.1em !important; 
                    min-height: 0.1em !important;
                }
                strong, b { 
                    font-weight: 700 !important; 
                }
                .font-serif { 
                    font-family: "Times New Roman", Times, serif !important; 
                }
                .font-sans { 
                    font-family: Arial, Helvetica, sans-serif !important; 
                }
                .font-monospace { 
                    font-family: "Courier New", Courier, monospace !important; 
                }
  
            `,
      setup: (editor) => {
        this.editor = editor;
        this.setupEditor(editor);
      },
    });
  }

  setupEditor(editor) {
    // Set existing content after editor is ready
    editor.on("init", () => {
      if (this.options.existingContent) {
        editor.setContent(this.options.existingContent);
      } else {
        console.log("No existing content to load");
      }
    });

    // Clean up pasted content from Google Docs
    editor.on("PastePreProcess", (e) => {
      // Remove bogus br tags and empty paragraphs
      e.content = e.content.replace(/<br[^>]*data-mce-bogus="1"[^>]*>/gi, "");
      e.content = e.content.replace(/<p>\s*<\/p>/gi, "<p>&nbsp;</p>");
    });

    // Custom keyboard shortcuts - using keydown events for better control
    editor.on("keydown", (e) => {
      // Mac: Cmd+] for indent, Cmd+[ for outdent
      if (e.metaKey && e.key === "]") {
        e.preventDefault();
        editor.execCommand("Indent");
      }
      if (e.metaKey && e.key === "[") {
        e.preventDefault();
        editor.execCommand("Outdent");
      }
      // Windows/Linux: Ctrl+] for indent, Ctrl+[ for outdent
      if (e.ctrlKey && e.key === "]") {
        e.preventDefault();
        editor.execCommand("Indent");
      }
      if (e.ctrlKey && e.key === "[") {
        e.preventDefault();
        editor.execCommand("Outdent");
      }
    });

    // Update form input before submission
    if (this.options.formSelector) {
      this.setupFormSubmission(editor);
    }
  }

  setupFormSubmission(editor) {
    // Update form input before submission
    editor.on("submit", () => {
      const content = editor.getContent();
      const formInput = document.querySelector(this.options.formSelector);
      if (formInput) {
        formInput.value = content;
      }
    });
  }

  getContent() {
    return this.editor ? this.editor.getContent() : "";
  }

  setContent(content) {
    if (this.editor) {
      this.editor.setContent(content);
    }
  }
}

// Make class globally available
window.GigDocumentEditor = GigDocumentEditor;

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = GigDocumentEditor;
}
