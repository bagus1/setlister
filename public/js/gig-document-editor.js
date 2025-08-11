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
      plugins: "table lists link",
      toolbar:
        "undo redo | formatselect | bold italic underline | alignleft aligncenter alignright | bullist numlist | indent outdent | link table | removeformat",
      menubar: false,
      content_style: `
                body { 
                    font-family: Arial, Helvetica, sans-serif !important; 
                    font-size: 14px !important; 
                    font-weight: 600 !important; 
                    line-height: 1.3 !important; 
                }
                p { 
                    margin: 0.2em 0 !important; 
                    line-height: 1.2 !important; 
                    font-weight: 600 !important;
                }
                p:empty { 
                    margin: 0.1em 0 !important; 
                    height: 0.1em !important; 
                    min-height: 0.1em !important;
                }
                strong, b { 
                    font-weight: 800 !important; 
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
