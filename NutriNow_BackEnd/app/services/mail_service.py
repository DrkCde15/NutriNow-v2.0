import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

def envoyer_email(destinatario, assunto, mensagem_html):
    remetente = os.getenv("EMAIL_SENDER", "nnutrinow@gmail.com")
    senha = os.getenv("EMAIL_PASSWORD")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = remetente
    msg["To"] = destinatario
    msg.attach(MIMEText(mensagem_html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(remetente, senha)
            server.sendmail(remetente, destinatario, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar email: {e}")
        return False
