from flask import Blueprint, request, send_file
from datetime import datetime, timedelta
from io import BytesIO
import pandas as pd

from database.db import db
from models.temp_values import TempValues

export_bp = Blueprint('telemetry_export', __name__)

PHASE_COLUMNS = [
    'R1', 'Y1', 'B1', 'N1',
    'R2', 'Y2', 'B2', 'N2',
    'R3', 'Y3', 'B3', 'N3',
    'R4', 'Y4', 'B4', 'N4',
    'R5', 'Y5', 'B5', 'N5',
    'R6', 'Y6', 'B6', 'N6',
]


@export_bp.route('/api/telemetry-export', methods=['GET'])
def telemetry_export():
    """
    GET /api/telemetry-export?serial_no=WTSF0C02E&start_date=2026-07-30&end_date=2026-07-30

    - serial_no  : required
    - start_date : required, YYYY-MM-DD
    - end_date   : required, YYYY-MM-DD (same as start_date for a single day/"today")

    Returns an .xlsx file download named wts_dd_mm_yy_to_dd_mm_yy.xlsx
    """
    serial_no = request.args.get('serial_no')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not serial_no or not start_date or not end_date:
        return {'error': 'serial_no, start_date and end_date are required'}, 400

    try:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        # inclusive of the whole end day
        end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
    except ValueError:
        return {'error': 'Dates must be in YYYY-MM-DD format'}, 400

    if end_dt <= start_dt:
        return {'error': 'end_date must be on or after start_date'}, 400

    rows = (
        TempValues.query
        .filter(
            TempValues.serial_no == serial_no,
            TempValues.timestamp >= start_dt,
            TempValues.timestamp < end_dt,
        )
        .order_by(TempValues.timestamp.asc())
        .all()
    )

    if not rows:
        return {'error': 'No data found for the selected range'}, 404

    records = []
    for r in rows:
        row_dict = {
            'Timestamp': r.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
        }
        for col in PHASE_COLUMNS:
            row_dict[col] = getattr(r, col)
        records.append(row_dict)

    df = pd.DataFrame(records, columns=['Timestamp'] + PHASE_COLUMNS)

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Telemetry')

        # Auto-fit column widths
        ws = writer.sheets['Telemetry']
        for i, col in enumerate(df.columns, start=1):
            col_max = df[col].map(lambda x: len(str(x))).max()
            if pd.isna(col_max):
                col_max = 0
            max_len = max(int(col_max), len(col)) + 2
            ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = max_len

    buffer.seek(0)

    start_label = datetime.strptime(start_date, '%Y-%m-%d').strftime('%d_%m_%y')
    end_label = (end_dt - timedelta(days=1)).strftime('%d_%m_%y')
    filename = f"wts_{start_label}_to_{end_label}.xlsx"

    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )