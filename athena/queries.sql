SELECT ip, COUNT(*) as request_count
FROM logs_processed
GROUP BY ip
ORDER BY request_count DESC
LIMIT 10;

//query 2
SELECT statuscode, COUNT(*) as count
FROM logs_processed
GROUP BY statuscode
ORDER BY count DESC;


//query3
SELECT ip, method, path, statuscode, timestamp
FROM logs_processed
WHERE is_suspicious = true
ORDER BY timestamp DESC
LIMIT 20;

//query 4
SELECT algorithm, COUNT(*) as total_requests,
       SUM(CASE WHEN is_suspicious THEN 1 ELSE 0 END) as suspicious_count
FROM logs_processed
GROUP BY algorithm
ORDER BY total_requests DESC;

//query 5
SELECT hour_bucket, COUNT(*) as request_count,
       SUM(CASE WHEN statuscode = 429 THEN 1 ELSE 0 END) as rate_limited_count
FROM logs_processed
GROUP BY hour_bucket
ORDER BY hour_bucket;