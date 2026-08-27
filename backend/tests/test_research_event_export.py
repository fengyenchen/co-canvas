from urllib.parse import quote

from app.routers.projects import create_attachment_header


def test_attachment_header_supports_chinese_project_names() -> None:
    filename = "中文專案-research-events.csv"
    header = create_attachment_header(filename)

    assert header.isascii()
    assert header == (
        'attachment; filename="research-events.csv"; '
        f"filename*=UTF-8''{quote(filename, safe='')}"
    )
