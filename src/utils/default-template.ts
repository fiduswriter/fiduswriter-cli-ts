import type {FidusNode} from "@fiduswriter/document"

export function getDefaultTemplate(): Record<string, unknown> {
    return {
        content: {
            type: "doc",
            attrs: {
                import_id: "default",
                template: "Default",
                papersize: "A4",
                papersizes: ["A4"],
                citationstyle: "apa",
                citationstyles: ["apa"],
                documentstyle: "default",
                language: "en-US",
                languages: ["en-US"],
                footnote_marks: [],
                footnote_elements: [],
                bibliography_header: {
                    type: "text",
                    content: [{type: "text", text: "Bibliography"}]
                },
                metadata: {}
            },
            content: [
                {type: "title"},
                {
                    type: "contributors_part",
                    attrs: {
                        metadata: "authors",
                        title: "Authors",
                        locking: false,
                        optional: false,
                        help: "",
                        deleted: false,
                        hidden: false,
                        language: ""
                    }
                },
                {
                    type: "richtext_part",
                    attrs: {
                        id: "body",
                        title: "Body",
                        locking: false,
                        optional: false,
                        help: "",
                        deleted: false,
                        hidden: false,
                        language: "",
                        initial: [{type: "paragraph"}],
                        elements: ["paragraph"]
                    },
                    content: [{type: "paragraph"}]
                },
                {
                    type: "tags_part",
                    attrs: {
                        metadata: "keywords",
                        title: "Keywords",
                        locking: false,
                        optional: false,
                        help: "",
                        deleted: false,
                        hidden: false,
                        language: ""
                    }
                }
            ]
        } as unknown as FidusNode,
        export_templates: [],
        document_styles: [
            {
                title: "Default",
                slug: "default",
                contents: "",
                files: []
            }
        ],
        files: []
    }
}
