from PyPDF2 import PdfReader

def get_pdf_text_with_page_info(pdf_docs, filename):
    """Extrai texto de múltiplos PDFs com informações de número de página e filename."""
    all_text_with_page_info = []

    for pdf in pdf_docs:
        pdf_reader = PdfReader(pdf)
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            if page_text:
                all_text_with_page_info.append({
                    "text": page_text, 
                    "page": page_num + 1, 
                    "filename": filename  # Adicionando o 'filename' no item
                })
    return all_text_with_page_info