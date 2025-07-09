import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import json
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)

def json_converter(o):
    if isinstance(o, datetime):
        return o.__str__()

@app.route("/api/list-collections", methods=["POST"])
def list_collections():
    if 'serviceAccountKey' not in request.files:
        return jsonify(error="Nenhum arquivo de chave de serviço enviado"), 400
    file = request.files['serviceAccountKey']
    app_name = f'temp-app-{uuid.uuid4()}'
    app_instance = None
    try:
        key_content = json.load(file)
        cred = credentials.Certificate(key_content)
        app_instance = firebase_admin.initialize_app(cred, name=app_name)
        db = firestore.client(app=app_instance)
        collections = [collection.id for collection in db.collections()]
        return jsonify(collections=collections)
    except Exception as e:
        return jsonify(error=f"Erro ao processar a chave: {e}"), 500
    finally:
        if app_instance:
            firebase_admin.delete_app(app_instance)

@app.route("/api/generate-backup", methods=["POST"])
def generate_backup():
    if 'serviceAccountKey' not in request.files:
        return jsonify(error="Nenhum arquivo de chave de serviço enviado"), 400
    if 'collections' not in request.form:
        return jsonify(error="Nenhuma coleção especificada"), 400

    file = request.files['serviceAccountKey']
    collections_str = request.form['collections']
    collections_list = collections_str.split(',')
    
    app_name = f'temp-app-{uuid.uuid4()}'
    app_instance = None
    
    try:
        key_content = json.load(file)
        cred = credentials.Certificate(key_content)
        app_instance = firebase_admin.initialize_app(cred, name=app_name)
        db = firestore.client(app=app_instance)

        full_backup = {}
        for collection_name in collections_list:
            collection_data = {}
            docs = db.collection(collection_name).stream()
            for doc in docs:
                collection_data[doc.id] = doc.to_dict()
            full_backup[collection_name] = collection_data

        json_backup = json.dumps(full_backup, indent=2, ensure_ascii=False, default=json_converter)
        
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"firestore_backup_{timestamp}.json"

        return Response(
            json_backup,
            mimetype="application/json",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )
    except Exception as e:
        return jsonify(error=f"Erro ao gerar o backup: {e}"), 500
    finally:
        if app_instance:
            firebase_admin.delete_app(app_instance)

if __name__ == "__main__":
    app.run(debug=True, port=5000)