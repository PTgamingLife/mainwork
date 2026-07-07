from flask import Flask, render_template, request, jsonify
import anthropic
import os
import re
import json
import uuid
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

ENV_PATH     = Path(__file__).parent / '.env'
PROJECTS_DIR = Path(__file__).parent / 'projects'
PROJECTS_DIR.mkdir(exist_ok=True)


def _save_api_key(key: str):
    """Write or replace ANTHROPIC_API_KEY in the .env file."""
    content = ENV_PATH.read_text(encoding='utf-8') if ENV_PATH.exists() else ''
    pattern = r'^ANTHROPIC_API_KEY=.*$'
    new_line = f'ANTHROPIC_API_KEY={key}'
    if re.search(pattern, content, re.MULTILINE):
        content = re.sub(pattern, new_line, content, flags=re.MULTILINE)
    else:
        content = content.rstrip('\n') + ('\n' if content else '') + new_line + '\n'
    ENV_PATH.write_text(content, encoding='utf-8')
    os.environ['ANTHROPIC_API_KEY'] = key


@app.route('/api-key/status')
def api_key_status():
    key = os.getenv('ANTHROPIC_API_KEY', '')
    if key:
        masked = key[:10] + '···' + key[-4:]
        return jsonify({'configured': True, 'masked': masked})
    return jsonify({'configured': False, 'masked': ''})


@app.route('/api-key', methods=['POST'])
def set_api_key():
    data = request.json or {}
    key = (data.get('key') or '').strip()
    if not key:
        return jsonify({'error': '請輸入 API 金鑰'}), 400
    if not key.startswith('sk-ant-'):
        return jsonify({'error': '金鑰格式不正確（應以 sk-ant- 開頭）'}), 400
    try:
        # Quick validation ping
        client = anthropic.Anthropic(api_key=key)
        client.models.list()
    except anthropic.AuthenticationError:
        return jsonify({'error': '金鑰無效，請確認後重試'}), 401
    except Exception:
        pass  # network issues etc. — still save
    _save_api_key(key)
    return jsonify({'ok': True})


# ── Project endpoints ────────────────────────────────────────

@app.route('/projects', methods=['GET'])
def list_projects():
    projects = []
    for f in sorted(PROJECTS_DIR.glob('*.json'),
                    key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding='utf-8'))
            projects.append({
                'id':        data['id'],
                'name':      data['name'],
                'createdAt': data['createdAt'],
                'updatedAt': data['updatedAt'],
                'rootText':  data.get('tree', {}).get('text', ''),
            })
        except Exception:
            pass
    return jsonify(projects)


@app.route('/projects', methods=['POST'])
def save_project():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    tree = data.get('tree')
    if not name:
        return jsonify({'error': '請輸入專案名稱'}), 400
    if not tree:
        return jsonify({'error': '心智圖為空'}), 400
    pid  = uuid.uuid4().hex[:10]
    now  = datetime.now().strftime('%Y-%m-%d %H:%M')
    project = {'id': pid, 'name': name,
                'createdAt': now, 'updatedAt': now, 'tree': tree}
    (PROJECTS_DIR / f'{pid}.json').write_text(
        json.dumps(project, ensure_ascii=False, indent=2), encoding='utf-8')
    return jsonify({'id': pid, 'name': name, 'createdAt': now})


@app.route('/projects/<pid>', methods=['GET'])
def load_project(pid):
    path = PROJECTS_DIR / f'{pid}.json'
    if not path.exists():
        return jsonify({'error': '專案不存在'}), 404
    return jsonify(json.loads(path.read_text(encoding='utf-8')))


@app.route('/projects/<pid>', methods=['DELETE'])
def delete_project(pid):
    path = PROJECTS_DIR / f'{pid}.json'
    if path.exists():
        path.unlink()
    return jsonify({'ok': True})


# ── Main app ─────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/generate', methods=['POST'])
def generate_content():
    try:
        data = request.json
        mind_map = data.get('mindMap')
        output_format = data.get('format', 'markdown')

        if not mind_map or not mind_map.get('text'):
            return jsonify({'error': '請先建立心智圖內容'}), 400

        map_description = serialize_mindmap(mind_map)

        if output_format == 'markdown':
            format_instr = (
                "請使用 Markdown 格式輸出：用 # ## ### 作標題層級、"
                "**粗體** 強調重點、- 作列表項目、> 引用重要概念"
            )
        else:
            format_instr = "請使用純文字格式輸出，不使用任何 Markdown 語法或特殊符號"

        prompt = f"""你是一位專業的內容創作者。請根據以下心智圖結構，撰寫一篇完整、有深度且邏輯清晰的文章。

【心智圖結構】
{map_description}

【寫作規則】
1. 以根節點（主題）作為文章核心與標題
2. 每個主要分支對應一個主要章節
3. 子節點的內容整合至對應章節中，作為細節說明
4. 若節點附有「參考文件」，請參考其內容豐富對應章節，並融入文章，不要直接複製貼上
5. 用流暢、自然的語言連接各概念，不要只是列出清單
6. 確保文章涵蓋心智圖中的所有節點
7. {format_instr}
8. 文章要有完整的開頭、主體、結論

請開始撰寫文章："""

        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            return jsonify({'error': '請在 .env 檔案中設定 ANTHROPIC_API_KEY'}), 500

        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model='claude-sonnet-4-6',
            max_tokens=4096,
            messages=[{'role': 'user', 'content': prompt}]
        )

        return jsonify({
            'content': message.content[0].text,
            'format': output_format
        })

    except anthropic.AuthenticationError:
        return jsonify({'error': 'API 金鑰無效，請檢查 ANTHROPIC_API_KEY 設定'}), 401
    except Exception as e:
        return jsonify({'error': f'生成失敗：{str(e)}'}), 500


def serialize_mindmap(node, level=0):
    if not node or not node.get('text'):
        return ''

    indent = '    ' * level
    lines  = []

    if level == 0:
        lines.append(f'◆ 主題：{node["text"]}')
    else:
        marker = '├─ ' if level == 1 else '└─ '
        lines.append(f'{indent}{marker}{node["text"]}')

    # Embed attached file content so AI can use it as reference
    att = node.get('attachment')
    if att and att.get('content'):
        att_indent = indent + '    '
        lines.append(f'{att_indent}【參考文件：{att.get("name", "attachment")}】')
        for ln in att['content'][:4000].splitlines():
            lines.append(f'{att_indent}  {ln}')
        lines.append(f'{att_indent}【文件結束】')

    for child in node.get('children', []):
        child_text = serialize_mindmap(child, level + 1)
        if child_text:
            lines.append(child_text)

    return '\n'.join(lines)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print('=' * 50)
    print('  AI 心智圖內容生成器')
    print('=' * 50)
    print(f'  訪問：http://localhost:{port}')
    print('  按 Ctrl+C 停止伺服器')
    print('=' * 50)
    app.run(debug=True, port=port, use_reloader=False)
