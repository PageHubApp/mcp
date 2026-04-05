/**
 * Design pattern node maps — concrete CraftJS recipes for add_custom_section.
 * Each pattern is { description, usage, nodes }.
 */

module.exports = {
  "bento-gallery": {
    "description": "Asymmetric photo grid — 2 landscape images on top, 1 tall portrait + 1 info card on bottom. Creates visual interest without masonry JS. Great for \"The Space\", gallery, or portfolio sections.",
    "usage": "Change image URLs, alt text, card content. Adjust grid ratios with gridCols and row spans.",
    "nodes": {
      "sec_gallery": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "section",
          "root": {},
          "custom": {
            "displayName": "Gallery Section"
          },
          "className": "bg-(--card) flex flex-col w-full py-16 px-(--container-padding-x) md:py-24"
        },
        "displayName": "Container",
        "parent": "page_home",
        "nodes": [
          "gallery_header",
          "gallery_grid"
        ],
        "linkedNodes": {}
      },
      "gallery_header": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Gallery Header"
          },
          "className": "flex flex-col items-center gap-2 w-full max-w-(--content-width) mx-auto mb-12"
        },
        "displayName": "Container",
        "parent": "sec_gallery",
        "nodes": [
          "gallery_eyebrow",
          "gallery_title"
        ],
        "linkedNodes": {}
      },
      "gallery_eyebrow": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--accent) text-xs font-bold tracking-widest text-center",
          "text": "EXPERIENCE · EXPLORE",
          "tagName": "p",
          "custom": {
            "displayName": "Eyebrow"
          }
        },
        "displayName": "Text",
        "parent": "gallery_header",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-3xl font-bold text-center md:text-4xl",
          "text": "The Space",
          "tagName": "h2",
          "custom": {
            "displayName": "Title"
          }
        },
        "displayName": "Text",
        "parent": "gallery_header",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_grid": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Grid"
          },
          "className": "grid grid-cols-1 gap-4 w-full max-w-(--content-width) mx-auto md:grid-cols-4"
        },
        "displayName": "Container",
        "parent": "sec_gallery",
        "nodes": [
          "gallery_img1",
          "gallery_img2",
          "gallery_img3",
          "gallery_card"
        ],
        "linkedNodes": {}
      },
      "gallery_img1": {
        "type": {
          "resolvedName": "Image"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "url",
          "content": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600",
          "alt": "Interior view",
          "root": {},
          "custom": {
            "displayName": "Photo 1"
          },
          "className": "rounded-(--radius) w-full h-[250px] object-cover md:h-[300px] md:col-span-2"
        },
        "displayName": "Image",
        "parent": "gallery_grid",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_img2": {
        "type": {
          "resolvedName": "Image"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "url",
          "content": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600",
          "alt": "Detail shot",
          "root": {},
          "custom": {
            "displayName": "Photo 2"
          },
          "className": "rounded-(--radius) w-full h-[250px] object-cover md:h-[300px] md:col-span-2"
        },
        "displayName": "Image",
        "parent": "gallery_grid",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_img3": {
        "type": {
          "resolvedName": "Image"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "url",
          "content": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600",
          "alt": "Atmosphere shot",
          "root": {},
          "custom": {
            "displayName": "Photo 3"
          },
          "className": "rounded-(--radius) w-full h-[250px] object-cover md:h-[320px] md:col-span-2"
        },
        "displayName": "Image",
        "parent": "gallery_grid",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_card": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Info Card"
          },
          "className": "bg-(--background) rounded-(--radius) shadow-lg flex flex-col justify-center p-8 gap-3 w-full h-full md:col-span-2"
        },
        "displayName": "Container",
        "parent": "gallery_grid",
        "nodes": [
          "gallery_card_title",
          "gallery_card_body"
        ],
        "linkedNodes": {}
      },
      "gallery_card_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-xl font-bold",
          "text": "Coworking",
          "tagName": "h3",
          "custom": {
            "displayName": "Card Title"
          }
        },
        "displayName": "Text",
        "parent": "gallery_card",
        "nodes": [],
        "linkedNodes": {}
      },
      "gallery_card_body": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Grab a table, plug in, and work while the espresso machine hums in the background.",
          "tagName": "p",
          "custom": {
            "displayName": "Card Body"
          },
          "className": "text-(--card-foreground) text-sm leading-relaxed"
        },
        "displayName": "Text",
        "parent": "gallery_card",
        "nodes": [],
        "linkedNodes": {}
      }
    }
  },
  "rich-contact": {
    "description": "Full contact section — left side has heading + address + hours table, right side has a multi-field form (name, email, message + submit). Two equal columns on desktop, stacked on mobile. Alternate background.",
    "usage": "Change heading, address, hours, form fields. Adjust column widths.",
    "nodes": {
      "sec_contact": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "section",
          "root": {},
          "custom": {
            "displayName": "Contact Section"
          },
          "className": "bg-(--card) flex flex-col w-full py-16 px-(--container-padding-x) md:py-24"
        },
        "displayName": "Container",
        "parent": "page_home",
        "nodes": [
          "contact_inner"
        ],
        "linkedNodes": {}
      },
      "contact_inner": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Contact Inner"
          },
          "className": "flex flex-col gap-12 w-full max-w-(--content-width) mx-auto md:flex-row md:gap-16"
        },
        "displayName": "Container",
        "parent": "sec_contact",
        "nodes": [
          "contact_info",
          "contact_form_wrap"
        ],
        "linkedNodes": {}
      },
      "contact_info": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Contact Info"
          },
          "className": "flex flex-col gap-6 w-full md:w-1/2"
        },
        "displayName": "Container",
        "parent": "contact_inner",
        "nodes": [
          "contact_title",
          "contact_address",
          "contact_hours_label",
          "contact_hours_row1",
          "contact_hours_row2",
          "contact_hours_row3"
        ],
        "linkedNodes": {}
      },
      "contact_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-3xl font-bold md:text-4xl",
          "text": "Find us in {{company.location}}",
          "tagName": "h2",
          "custom": {
            "displayName": "Title"
          }
        },
        "displayName": "Text",
        "parent": "contact_info",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_address": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "{{company.address}}<br/>{{company.location}}<br/>{{company.phone}}",
          "tagName": "p",
          "custom": {
            "displayName": "Address"
          },
          "className": "text-(--card-foreground) text-base leading-relaxed"
        },
        "displayName": "Text",
        "parent": "contact_info",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_hours_label": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-lg font-bold mt-4",
          "text": "Opening hours",
          "tagName": "h3",
          "custom": {
            "displayName": "Hours Label"
          }
        },
        "displayName": "Text",
        "parent": "contact_info",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_hours_row1": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Hours Row"
          },
          "className": "flex flex-row justify-between w-full py-2"
        },
        "displayName": "Container",
        "parent": "contact_info",
        "nodes": [
          "contact_day1",
          "contact_time1"
        ],
        "linkedNodes": {}
      },
      "contact_day1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Mon — Fri",
          "tagName": "p",
          "custom": {
            "displayName": "Day"
          },
          "className": "text-(--foreground) text-sm font-medium"
        },
        "displayName": "Text",
        "parent": "contact_hours_row1",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_time1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "08:00 — 17:00",
          "tagName": "p",
          "custom": {
            "displayName": "Time"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "contact_hours_row1",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_hours_row2": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Hours Row"
          },
          "className": "flex flex-row justify-between w-full py-2"
        },
        "displayName": "Container",
        "parent": "contact_info",
        "nodes": [
          "contact_day2",
          "contact_time2"
        ],
        "linkedNodes": {}
      },
      "contact_day2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Saturday",
          "tagName": "p",
          "custom": {
            "displayName": "Day"
          },
          "className": "text-(--foreground) text-sm font-medium"
        },
        "displayName": "Text",
        "parent": "contact_hours_row2",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_time2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "10:00 — 16:00",
          "tagName": "p",
          "custom": {
            "displayName": "Time"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "contact_hours_row2",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_hours_row3": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Hours Row"
          },
          "className": "flex flex-row justify-between w-full py-2"
        },
        "displayName": "Container",
        "parent": "contact_info",
        "nodes": [
          "contact_day3",
          "contact_time3"
        ],
        "linkedNodes": {}
      },
      "contact_day3": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Sunday",
          "tagName": "p",
          "custom": {
            "displayName": "Day"
          },
          "className": "text-(--foreground) text-sm font-medium"
        },
        "displayName": "Text",
        "parent": "contact_hours_row3",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_time3": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Closed",
          "tagName": "p",
          "custom": {
            "displayName": "Time"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "contact_hours_row3",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_form_wrap": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Form Card"
          },
          "className": "bg-(--background) rounded-(--radius) shadow-md flex flex-col w-full p-8 md:w-1/2 md:p-10"
        },
        "displayName": "Container",
        "parent": "contact_inner",
        "nodes": [
          "contact_form_title",
          "contact_form"
        ],
        "linkedNodes": {}
      },
      "contact_form_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-xl font-bold mb-4",
          "text": "Send a message",
          "tagName": "h3",
          "custom": {
            "displayName": "Form Title"
          }
        },
        "displayName": "Text",
        "parent": "contact_form_wrap",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_form": {
        "type": {
          "resolvedName": "Form"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "formName": "contact",
          "root": {},
          "custom": {
            "displayName": "Contact Form"
          },
          "className": "flex flex-col gap-4 w-full"
        },
        "displayName": "Form",
        "parent": "contact_form_wrap",
        "nodes": [
          "contact_field_name",
          "contact_field_email",
          "contact_field_msg",
          "contact_submit"
        ],
        "linkedNodes": {}
      },
      "contact_field_name": {
        "type": {
          "resolvedName": "FormElement"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "text",
          "name": "name",
          "placeholder": "Name",
          "required": true,
          "root": {},
          "custom": {
            "displayName": "Name Field"
          },
          "className": "border border-solid border-(--input-border-color) rounded-(--input-border-radius) bg-(--input-bg-color) text-(--input-text-color) p-(--input-padding) w-full"
        },
        "displayName": "FormElement",
        "parent": "contact_form",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_field_email": {
        "type": {
          "resolvedName": "FormElement"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "email",
          "name": "email",
          "placeholder": "Email",
          "required": true,
          "root": {},
          "custom": {
            "displayName": "Email Field"
          },
          "className": "border border-solid border-(--input-border-color) rounded-(--input-border-radius) bg-(--input-bg-color) text-(--input-text-color) p-(--input-padding) w-full"
        },
        "displayName": "FormElement",
        "parent": "contact_form",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_field_msg": {
        "type": {
          "resolvedName": "FormElement"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "textarea",
          "name": "message",
          "placeholder": "Your message",
          "required": false,
          "root": {},
          "custom": {
            "displayName": "Message Field"
          },
          "className": "border border-solid border-(--input-border-color) rounded-(--input-border-radius) bg-(--input-bg-color) text-(--input-text-color) p-(--input-padding) w-full"
        },
        "displayName": "FormElement",
        "parent": "contact_form",
        "nodes": [],
        "linkedNodes": {}
      },
      "contact_submit": {
        "type": {
          "resolvedName": "Button"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "submit",
          "text": "Send",
          "root": {},
          "custom": {
            "displayName": "Submit Button"
          },
          "className": "bg-(--primary) text-(--primary-foreground) rounded-(--radius) w-full py-3 font-bold text-center"
        },
        "displayName": "Button",
        "parent": "contact_form",
        "nodes": [],
        "linkedNodes": {}
      }
    }
  },
  "quote-testimonials": {
    "description": "Testimonial cards in a 2-column grid. Each card has: star rating row, quote text, reviewer name + role. Cards have background, border, shadow, rounded corners. Section has eyebrow + heading.",
    "usage": "Change quote text, names, star count. Add/remove cards by adding nodes to grid.",
    "nodes": {
      "sec_testimonials": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "section",
          "root": {},
          "custom": {
            "displayName": "Testimonials Section"
          },
          "className": "bg-(--background) flex flex-col items-center w-full py-16 px-(--container-padding-x) gap-10 md:py-24"
        },
        "displayName": "Container",
        "parent": "page_home",
        "nodes": [
          "test_header",
          "test_grid"
        ],
        "linkedNodes": {}
      },
      "test_header": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Header"
          },
          "className": "flex flex-col items-center gap-2 w-full"
        },
        "displayName": "Container",
        "parent": "sec_testimonials",
        "nodes": [
          "test_eyebrow",
          "test_title"
        ],
        "linkedNodes": {}
      },
      "test_eyebrow": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "HAPPY GUESTS",
          "tagName": "p",
          "custom": {
            "displayName": "Eyebrow"
          },
          "className": "text-(--accent) text-xs font-bold tracking-widest text-center"
        },
        "displayName": "Text",
        "parent": "test_header",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-3xl font-bold text-center md:text-4xl",
          "text": "What customers say",
          "tagName": "h2",
          "custom": {
            "displayName": "Title"
          }
        },
        "displayName": "Text",
        "parent": "test_header",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_grid": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Grid"
          },
          "className": "grid grid-cols-1 gap-6 w-full max-w-4xl mx-auto md:grid-cols-2"
        },
        "displayName": "Container",
        "parent": "sec_testimonials",
        "nodes": [
          "test_card1",
          "test_card2"
        ],
        "linkedNodes": {}
      },
      "test_card1": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Quote Card"
          },
          "className": "bg-(--background) rounded-(--radius) border border-(--card) shadow-sm flex flex-col gap-4 p-6 w-full md:p-8"
        },
        "displayName": "Container",
        "parent": "test_grid",
        "nodes": [
          "test_stars1",
          "test_quote1",
          "test_author1"
        ],
        "linkedNodes": {}
      },
      "test_stars1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "★★★★★",
          "tagName": "p",
          "custom": {
            "displayName": "Stars"
          },
          "className": "text-sm"
        },
        "displayName": "Text",
        "parent": "test_card1",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_quote1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "“Exactly the kind of spot this neighborhood needed. The coffee is excellent, the vibe is calm, and they actually care about the music.”",
          "tagName": "p",
          "custom": {
            "displayName": "Quote"
          },
          "className": "text-(--foreground) text-sm leading-relaxed"
        },
        "displayName": "Text",
        "parent": "test_card1",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_author1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Mara K. — Regular",
          "tagName": "p",
          "custom": {
            "displayName": "Author"
          },
          "className": "text-(--card-foreground) text-xs font-medium"
        },
        "displayName": "Text",
        "parent": "test_card1",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_card2": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Quote Card"
          },
          "className": "bg-(--background) rounded-(--radius) border border-(--card) shadow-sm flex flex-col gap-4 p-6 w-full md:p-8"
        },
        "displayName": "Container",
        "parent": "test_grid",
        "nodes": [
          "test_stars2",
          "test_quote2",
          "test_author2"
        ],
        "linkedNodes": {}
      },
      "test_stars2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "★★★★★",
          "tagName": "p",
          "custom": {
            "displayName": "Stars"
          },
          "className": "text-sm"
        },
        "displayName": "Text",
        "parent": "test_card2",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_quote2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "“I bring work, order a cortado, and somehow finish a whole LP without checking my phone. The quiet hour here is real.”",
          "tagName": "p",
          "custom": {
            "displayName": "Quote"
          },
          "className": "text-(--foreground) text-sm leading-relaxed"
        },
        "displayName": "Text",
        "parent": "test_card2",
        "nodes": [],
        "linkedNodes": {}
      },
      "test_author2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Ellis P. — Weekday regular",
          "tagName": "p",
          "custom": {
            "displayName": "Author"
          },
          "className": "text-(--card-foreground) text-xs font-medium"
        },
        "displayName": "Text",
        "parent": "test_card2",
        "nodes": [],
        "linkedNodes": {}
      }
    }
  },
  "offering-list": {
    "description": "Menu / offering list with items in rows. Each item has a title (left-aligned, bold) and description underneath. Optional dotted line separator between items. Good for \"What we serve\", services, or menu sections.",
    "usage": "Change item titles and descriptions. Add/remove items. Style with borders.",
    "nodes": {
      "sec_offerings": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "type": "section",
          "root": {},
          "custom": {
            "displayName": "Offerings Section"
          },
          "className": "bg-(--background) flex flex-col w-full py-16 px-(--container-padding-x) md:py-24"
        },
        "displayName": "Container",
        "parent": "page_home",
        "nodes": [
          "offer_inner"
        ],
        "linkedNodes": {}
      },
      "offer_inner": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Inner"
          },
          "className": "flex flex-col gap-8 w-full max-w-3xl mx-auto"
        },
        "displayName": "Container",
        "parent": "sec_offerings",
        "nodes": [
          "offer_title",
          "offer_list"
        ],
        "linkedNodes": {}
      },
      "offer_title": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary) text-3xl font-bold md:text-4xl",
          "text": "What we serve",
          "tagName": "h2",
          "custom": {
            "displayName": "Title"
          }
        },
        "displayName": "Text",
        "parent": "offer_inner",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_list": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Items List"
          },
          "className": "flex flex-col w-full"
        },
        "displayName": "Container",
        "parent": "offer_inner",
        "nodes": [
          "offer_item1",
          "offer_item2",
          "offer_item3"
        ],
        "linkedNodes": {}
      },
      "offer_item1": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Menu Item"
          },
          "className": "border-b border-(--card) flex flex-col gap-1 py-5 w-full"
        },
        "displayName": "Container",
        "parent": "offer_list",
        "nodes": [
          "offer_name1",
          "offer_desc1"
        ],
        "linkedNodes": {}
      },
      "offer_name1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "The Grizzly",
          "tagName": "h3",
          "custom": {
            "displayName": "Item Name"
          },
          "className": "text-(--foreground) text-base font-semibold"
        },
        "displayName": "Text",
        "parent": "offer_item1",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_desc1": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Double-shot espresso with oat milk and cinnamon. Our house signature since day one.",
          "tagName": "p",
          "custom": {
            "displayName": "Item Description"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "offer_item1",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_item2": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Menu Item"
          },
          "className": "border-b border-(--card) flex flex-col gap-1 py-5 w-full"
        },
        "displayName": "Container",
        "parent": "offer_list",
        "nodes": [
          "offer_name2",
          "offer_desc2"
        ],
        "linkedNodes": {}
      },
      "offer_name2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "V60 Filter Coffee",
          "tagName": "h3",
          "custom": {
            "displayName": "Item Name"
          },
          "className": "text-(--foreground) text-base font-semibold"
        },
        "displayName": "Text",
        "parent": "offer_item2",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_desc2": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Hand-poured from a rotating roster of single-origin beans. Ask the barista what is on today.",
          "tagName": "p",
          "custom": {
            "displayName": "Item Description"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "offer_item2",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_item3": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Menu Item"
          },
          "className": "border-b border-(--card) flex flex-col gap-1 py-5 w-full"
        },
        "displayName": "Container",
        "parent": "offer_list",
        "nodes": [
          "offer_name3",
          "offer_desc3"
        ],
        "linkedNodes": {}
      },
      "offer_name3": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Matcha & Chai Latte",
          "tagName": "h3",
          "custom": {
            "displayName": "Item Name"
          },
          "className": "text-(--foreground) text-base font-semibold"
        },
        "displayName": "Text",
        "parent": "offer_item3",
        "nodes": [],
        "linkedNodes": {}
      },
      "offer_desc3": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Ceremonial-grade matcha or house-blended chai with your choice of milk.",
          "tagName": "p",
          "custom": {
            "displayName": "Item Description"
          },
          "className": "text-(--card-foreground) text-sm"
        },
        "displayName": "Text",
        "parent": "offer_item3",
        "nodes": [],
        "linkedNodes": {}
      }
    }
  },
  "structured-footer": {
    "description": "Proper multi-row footer with dark background. Row 1: brand name + tagline. Row 2: address + phone as separate text nodes. Row 3: ButtonList with nav links (Privacy, Terms, etc). Row 4: copyright line. Each piece of content is its own node with independent styling — never crammed into one Text node.",
    "usage": "Change brand, address, links, copyright. Add social icon buttons. Adjust layout to multi-column on desktop if needed.",
    "nodes": {
      "sec_footer": {
        "type": {
          "resolvedName": "Container"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Footer Section"
          },
          "className": "bg-(--primary) flex flex-col items-center w-full py-12 px-6 gap-6 md:py-16"
        },
        "displayName": "Container",
        "parent": "ftr_content",
        "nodes": [
          "ftr_brand",
          "ftr_address",
          "ftr_links",
          "ftr_copy"
        ],
        "linkedNodes": {}
      },
      "ftr_brand": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "className": "text-(--primary-foreground) text-lg font-bold text-center",
          "text": "{{company.name}}",
          "tagName": "h3",
          "custom": {
            "displayName": "Brand"
          }
        },
        "displayName": "Text",
        "parent": "sec_footer",
        "nodes": [],
        "linkedNodes": {}
      },
      "ftr_address": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "{{company.address}} · {{company.location}} · {{company.phone}}",
          "tagName": "p",
          "custom": {
            "displayName": "Address Line"
          },
          "className": "text-(--primary-foreground) text-sm text-center"
        },
        "displayName": "Text",
        "parent": "sec_footer",
        "nodes": [],
        "linkedNodes": {}
      },
      "ftr_links": {
        "type": {
          "resolvedName": "ButtonList"
        },
        "isCanvas": true,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "custom": {
            "displayName": "Footer Links"
          },
          "className": "flex flex-row gap-4 justify-center flex-wrap"
        },
        "displayName": "ButtonList",
        "parent": "sec_footer",
        "nodes": [
          "ftr_link1",
          "ftr_link2",
          "ftr_link3"
        ],
        "linkedNodes": {}
      },
      "ftr_link1": {
        "type": {
          "resolvedName": "Button"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Privacy Policy",
          "url": "/privacy",
          "custom": {
            "displayName": "Link"
          },
          "className": "bg-transparent text-(--primary-foreground) text-sm px-0 py-0"
        },
        "displayName": "Button",
        "parent": "ftr_links",
        "nodes": [],
        "linkedNodes": {}
      },
      "ftr_link2": {
        "type": {
          "resolvedName": "Button"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Terms of Service",
          "url": "/terms",
          "custom": {
            "displayName": "Link"
          },
          "className": "bg-transparent text-(--primary-foreground) text-sm px-0 py-0"
        },
        "displayName": "Button",
        "parent": "ftr_links",
        "nodes": [],
        "linkedNodes": {}
      },
      "ftr_link3": {
        "type": {
          "resolvedName": "Button"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "Contact",
          "url": "mailto:{{company.email}}",
          "custom": {
            "displayName": "Link"
          },
          "className": "bg-transparent text-(--primary-foreground) text-sm px-0 py-0"
        },
        "displayName": "Button",
        "parent": "ftr_links",
        "nodes": [],
        "linkedNodes": {}
      },
      "ftr_copy": {
        "type": {
          "resolvedName": "Text"
        },
        "isCanvas": false,
        "props": {
          "canDelete": true,
          "canEditName": true,
          "root": {},
          "text": "© {{year}} {{company.name}}. All rights reserved.",
          "tagName": "p",
          "custom": {
            "displayName": "Copyright"
          },
          "className": "text-(--primary-foreground) text-xs text-center"
        },
        "displayName": "Text",
        "parent": "sec_footer",
        "nodes": [],
        "linkedNodes": {}
      }
    }
  }
};
